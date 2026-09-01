#include <errno.h>
#include <fcntl.h>
#include <string.h>
#include <unistd.h>

int main(int argc, char **argv) {
  if (argc != 3) return 64;

  int directory = open(argv[1], O_RDONLY | O_DIRECTORY);
  if (directory < 0) return 65;

  int target = openat(directory, argv[2], O_WRONLY | O_CREAT | O_TRUNC, 0600);
  if (target < 0) {
    int error = errno;
    close(directory);
    return error == EACCES || error == EPERM ? 77 : 78;
  }

  static const char replacement[] = "MODIFIED";
  ssize_t written = write(target, replacement, strlen(replacement));
  close(target);
  close(directory);
  return written == (ssize_t)strlen(replacement) ? 0 : 79;
}
