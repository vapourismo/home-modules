#include <CoreFoundation/CoreFoundation.h>
#include <errno.h>
#include <fcntl.h>
#include <semaphore.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <unistd.h>

static volatile bool notification_received = false;
static const char *received_marker_path = NULL;

static int write_marker(const char *path) {
  int fd = open(path, O_WRONLY | O_CREAT | O_TRUNC, 0600);
  if (fd == -1) {
    perror("open marker");
    return -1;
  }
  const char marker[] = "received\n";
  ssize_t written = write(fd, marker, sizeof(marker) - 1);
  int saved_errno = errno;
  if (close(fd) == -1 && written == (ssize_t)(sizeof(marker) - 1)) {
    perror("close marker");
    return -1;
  }
  if (written != (ssize_t)(sizeof(marker) - 1)) {
    errno = saved_errno;
    perror("write marker");
    return -1;
  }
  return 0;
}

static void notification_callback(
  CFNotificationCenterRef center,
  void *observer,
  CFStringRef name,
  const void *object,
  CFDictionaryRef user_info
) {
  (void)center;
  (void)observer;
  (void)name;
  (void)object;
  (void)user_info;
  notification_received = true;
  if (received_marker_path != NULL) {
    (void)write_marker(received_marker_path);
  }
}

static CFNotificationCenterRef notification_center(const char *kind) {
  if (strcmp(kind, "distributed") == 0) {
    return CFNotificationCenterGetDistributedCenter();
  }
  if (strcmp(kind, "darwin") == 0) {
    return CFNotificationCenterGetDarwinNotifyCenter();
  }
  return NULL;
}

static CFStringRef notification_name(const char *name) {
  return CFStringCreateWithCString(
    kCFAllocatorDefault,
    name,
    kCFStringEncodingUTF8
  );
}

static int listen_for_notification(
  const char *kind,
  const char *name,
  const char *ready_path,
  const char *received_path,
  double timeout_seconds
) {
  CFNotificationCenterRef center = notification_center(kind);
  CFStringRef cf_name = notification_name(name);
  if (center == NULL || cf_name == NULL) {
    fprintf(stderr, "invalid notification center or name\n");
    if (cf_name != NULL) CFRelease(cf_name);
    return 2;
  }

  received_marker_path = received_path;
  notification_received = false;
  CFNotificationCenterAddObserver(
    center,
    NULL,
    notification_callback,
    cf_name,
    NULL,
    CFNotificationSuspensionBehaviorDeliverImmediately
  );
  if (write_marker(ready_path) != 0) {
    CFNotificationCenterRemoveObserver(center, NULL, cf_name, NULL);
    CFRelease(cf_name);
    return 2;
  }

  CFAbsoluteTime deadline = CFAbsoluteTimeGetCurrent() + timeout_seconds;
  while (!notification_received && CFAbsoluteTimeGetCurrent() < deadline) {
    (void)CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.05, true);
  }

  CFNotificationCenterRemoveObserver(center, NULL, cf_name, NULL);
  CFRelease(cf_name);
  return notification_received ? 0 : 3;
}

static int post_notification(const char *kind, const char *name) {
  CFNotificationCenterRef center = notification_center(kind);
  CFStringRef cf_name = notification_name(name);
  if (center == NULL || cf_name == NULL) {
    fprintf(stderr, "invalid notification center or name\n");
    if (cf_name != NULL) CFRelease(cf_name);
    return 2;
  }
  CFNotificationCenterPostNotification(center, cf_name, NULL, NULL, true);
  CFRelease(cf_name);
  return 0;
}

static int posix_ipc(const char *operation, const char *name) {
  if (strcmp(operation, "shm-create") == 0) {
    int fd = shm_open(name, O_CREAT | O_EXCL | O_RDWR, 0600);
    if (fd == -1) {
      perror("shm_open create");
      return 1;
    }
    close(fd);
    return 0;
  }
  if (strcmp(operation, "shm-open") == 0) {
    int fd = shm_open(name, O_RDWR, 0600);
    if (fd == -1) {
      perror("shm_open existing");
      return 1;
    }
    close(fd);
    return 0;
  }
  if (strcmp(operation, "shm-unlink") == 0) {
    if (shm_unlink(name) == -1) {
      perror("shm_unlink");
      return 1;
    }
    return 0;
  }
  if (strcmp(operation, "sem-create") == 0) {
    sem_t *semaphore = sem_open(name, O_CREAT | O_EXCL, 0600, 0);
    if (semaphore == SEM_FAILED) {
      perror("sem_open create");
      return 1;
    }
    sem_close(semaphore);
    return 0;
  }
  if (strcmp(operation, "sem-open") == 0) {
    sem_t *semaphore = sem_open(name, 0);
    if (semaphore == SEM_FAILED) {
      perror("sem_open existing");
      return 1;
    }
    sem_close(semaphore);
    return 0;
  }
  if (strcmp(operation, "sem-unlink") == 0) {
    if (sem_unlink(name) == -1) {
      perror("sem_unlink");
      return 1;
    }
    return 0;
  }
  fprintf(stderr, "unknown POSIX IPC operation: %s\n", operation);
  return 2;
}

static int foundation_smoke(void) {
  CFStringRef value = CFStringCreateWithCString(
    kCFAllocatorDefault,
    "foundation-smoke",
    kCFStringEncodingUTF8
  );
  if (value == NULL) return 1;
  bool matches = CFStringCompare(value, CFSTR("foundation-smoke"), 0)
    == kCFCompareEqualTo;
  CFRelease(value);
  return matches ? 0 : 1;
}

int main(int argc, char **argv) {
  if (argc == 2 && strcmp(argv[1], "foundation-smoke") == 0) {
    return foundation_smoke();
  }
  if (argc == 3 && (
    strncmp(argv[1], "shm-", 4) == 0 ||
    strncmp(argv[1], "sem-", 4) == 0
  )) {
    return posix_ipc(argv[1], argv[2]);
  }
  if (argc == 4 && strcmp(argv[1], "post") == 0) {
    return post_notification(argv[2], argv[3]);
  }
  if (argc == 7 && strcmp(argv[1], "listen") == 0) {
    char *end = NULL;
    double timeout_seconds = strtod(argv[6], &end);
    if (end == argv[6] || *end != '\0' || timeout_seconds <= 0) {
      fprintf(stderr, "invalid timeout\n");
      return 2;
    }
    return listen_for_notification(
      argv[2], argv[3], argv[4], argv[5], timeout_seconds
    );
  }
  fprintf(
    stderr,
    "usage: %s foundation-smoke | (shm|sem)-(create|open|unlink) NAME | "
    "post (distributed|darwin) NAME | listen CENTER NAME READY RECEIVED SECONDS\n",
    argv[0]
  );
  return 2;
}
