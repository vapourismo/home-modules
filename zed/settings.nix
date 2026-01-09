{
  icon_theme = "Catppuccin Mocha";
  rounded_selection = true;
  restore_on_startup = "last_session";
  centered_layout = {
    left_padding = 0.3;
    right_padding = 0.3;
  };
  gutter = {
    min_line_number_digits = 1;
    line_numbers = true;
  };
  lsp_document_colors = "inlay";
  completions = {
    words_min_length = 2;
  };
  relative_line_numbers = "enabled";
  hover_popover_enabled = false;
  auto_signature_help = false;
  diagnostics = {
    inline = {
      enabled = false;
    };
  };
  terminal = {
    shell = "system";
    dock = "bottom";
    toolbar = {
      breadcrumbs = false;
    };
    env = {
      EDITOR = "/usr/local/bin/zed -w";
    };
  };
  zoomed_padding = true;
  active_pane_modifiers = {
    border_size = 0.5;
    inactive_opacity = 1.0;
  };
  use_system_window_tabs = false;
  bottom_dock_layout = "full";
  tabs = {
    activate_on_close = "left_neighbour";
    show_diagnostics = "errors";
    file_icons = false;
    git_status = false;
  };
  search = {
    center_on_match = true;
  };
  excerpt_context_lines = 15;
  project_panel = {
    git_status = true;
    hide_gitignore = true;
    button = true;
    entry_spacing = "standard";
  };
  tab_bar = {
    show_nav_history_buttons = false;
    show_tab_bar_buttons = false;
    show = true;
  };
  git = {
    path_style = "file_name_first";
    inline_blame = {
      enabled = false;
    };
  };
  inlay_hints = {
    show_background = true;
    enabled = true;
  };
  indent_guides = {
    background_coloring = "disabled";
    coloring = "indent_aware";
    line_width = 1;
  };
  preferred_line_length = 100;
  scrollbar = {
    show = "never";
  };
  sticky_scroll = {
    enabled = true;
  };
  autosave = "on_focus_change";
  base_keymap = "VSCode";
  buffer_font_family = "Iosevka Term SS02";
  theme = {
    mode = "system";
    light = "Catppuccin Latte - No Italics";
    dark = "Catppuccin Mocha - No Italics";
  };
  telemetry = {
    diagnostics = false;
    metrics = false;
  };
  vim_mode = true;
  ui_font_size = 16;
  buffer_font_size = 13.0;
  load_direnv = "direct";
  vertical_scroll_margin = 15;
  wrap_guides = [
    100
    120
  ];
  "experimental.theme_overrides" = {
    "terminal.ansi.black" = "#000000";
    "terminal.ansi.red" = "#ff3333";
    "terminal.ansi.green" = "#b8cc52";
    "terminal.ansi.yellow" = "#e7c547";
    "terminal.ansi.blue" = "#36a3d9";
    "terminal.ansi.magenta" = "#f07178";
    "terminal.ansi.cyan" = "#95e6cb";
    "terminal.ansi.white" = "#ffffff";
    "terminal.ansi.bright_black" = "#323232";
    "terminal.ansi.bright_red" = "#ff6565";
    "terminal.ansi.bright_green" = "#eafe84";
    "terminal.ansi.bright_yellow" = "#fff779";
    "terminal.ansi.bright_blue" = "#68d5ff";
    "terminal.ansi.bright_magenta" = "#ffa3aa";
    "terminal.ansi.bright_cyan" = "#c7fffd";
    "terminal.ansi.bright_white" = "#ffffff";
  };
  buffer_line_height = "standard";
  lsp = {
    rust-analyzer = {
      initialization_options = {
        check = {
          command = "clippy";
        };
        cargo = {
          targetDir = true;
        };
      };
    };
  };
}
