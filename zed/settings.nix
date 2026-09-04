{
  global_lsp_settings = {
    semantic_token_rules = [
      {
        token_type = "function";
      }
      {
        token_type = "method";
      }
    ];
  };
  theme_overrides = {
    "Catppuccin Mocha - No Italics" = {
      syntax = {
        "variable.parameter" = {
          color = "#cdd6f4";
        };
        "type.interface" = {
          color = "#fab387";
        };
      };
    };
  };
  format_on_save = "on";
  languages = {
    JSON = {
      format_on_save = "off";
    };
  };
  modeline_lines = 5;
  code_lens = "menu";
  vim = {
    show_edit_predictions_in_normal_mode = true;
    use_smartcase_find = true;
  };
  minimap = {
    show = "never";
  };
  inline_code_actions = true;
  buffer_font_weight = 400.0;
  soft_wrap = "none";
  disable_ai = false;
  selection_highlight = true;
  cli_default_open_behavior = "existing_window";
  completion_menu_item_kind = "symbol";
  document_symbols = "off";
  document_folding_ranges = "on";
  lsp_results_location = "picker";
  cursor_shape = "bar";
  cursor_blink = false;
  ui_font_family = ".ZedSans";
  outline_panel = {
    dock = "right";
  };
  collaboration_panel = {
    button = false;
    dock = "right";
  };
  diff_view_style = "split";
  semantic_tokens = "combined";
  title_bar = {
    show_branch_status_icon = false;
    show = false;
    show_menus = true;
    show_user_menu = true;
    show_onboarding_banner = true;
    show_sign_in = true;
    show_project_items = true;
    show_branch_name = true;
  };
  minimum_contrast_for_highlights = 45.0;
  go_to_definition_fallback = "none";
  calls = {
    mute_on_join = true;
  };
  buffer_line_height = {
    custom = 1.4;
  };
  git_panel = {
    button = false;
    dock = "right";
    tree_view = true;
  };
  agent = {
    sidebar_side = "right";
    show_merge_conflict_indicator = false;
    use_modifier_to_send = true;
    enable_feedback = false;
    dock = "right";
    expand_terminal_card = true;
  };
  edit_predictions = {
    allow_data_collection = "no";
    provider = "zed";
    mode = "eager";
  };
  icon_theme = {
    mode = "system";
    light = "Catppuccin Latte";
    dark = "Catppuccin Mocha";
  };
  rounded_selection = false;
  restore_on_startup = "last_session";
  centered_layout = {
    left_padding = 0.3;
    right_padding = 0.3;
  };
  gutter = {
    min_line_number_digits = 1;
    git_gutter_width = "default";
    runnables = false;
    breakpoints = true;
    bookmarks = true;
    folds = true;
    line_numbers = true;
  };
  lsp_document_colors = "inlay";
  completions = {
    words_min_length = 2;
    words = "fallback";
  };
  hover_popover_enabled = false;
  diagnostics = {
    inline = {
      min_column = 0;
      padding = 4;
      enabled = false;
    };
  };
  toolbar = {
    agent_review = false;
    code_actions = false;
    quick_actions = false;
    selections_menu = false;
    breadcrumbs = true;
    height = 20;
  };
  terminal = {
    font_weight = 400.0;
    show_count_badge = false;
    flexible = true;
    option_as_meta = true;
    shell = "system";
    dock = "bottom";
    toolbar = {
      breadcrumbs = false;
    };
    env = {
      EDITOR = "zed -w";
    };
    font_features = {
      liga = true;
      calt = true;
    };
    working_directory = "current_project_directory";
  };
  zoomed_padding = false;
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
    dock = "left";
    git_status = true;
    hide_gitignore = true;
    button = true;
    entry_spacing = "standard";
  };
  tab_bar = {
    show_nav_history_buttons = false;
    show_tab_bar_buttons = false;
    show = false;
  };
  git = {
    path_style = "file_name_first";
    inline_blame = {
      enabled = false;
    };
  };
  inlay_hints = {
    show_other_hints = true;
    show_parameter_hints = true;
    show_type_hints = false;
    show_value_hints = true;
    show_background = true;
    enabled = true;
  };
  indent_guides = {
    active_line_width = 1;
    enabled = true;
    background_coloring = "disabled";
    coloring = "fixed";
    line_width = 1;
  };
  preferred_line_length = 100;
  scrollbar = {
    axes = {
      vertical = false;
      horizontal = false;
    };
    cursors = true;
    show = "never";
  };
  sticky_scroll = {
    enabled = true;
  };
  auto_signature_help = false;
  autosave = "on_focus_change";
  base_keymap = "VSCode";
  buffer_font_family = "IosevkaTermSS02 Nerd Font";
  theme = {
    mode = "system";
    light = "Catppuccin Latte - No Italics";
    dark = "Catppuccin Mocha - No Italics";
  };
  "experimental.theme_overrides" = {
    syntax = {
      emphasis = {
        font_style = "normal";
      };
      property = {
        font_style = "normal";
      };
      attribute = {
        font_style = "normal";
      };
      "variable.special" = {
        font_style = "normal";
      };
      enum = {
        font_style = "normal";
      };
      type = {
        font_style = "normal";
      };
      "type.builtin" = {
        font_style = "normal";
      };
      constructor = {
        font_style = "normal";
      };
      comment = {
        font_style = "normal";
      };
      "comment.doc" = {
        font_style = "normal";
      };
    };
  };
  telemetry = {
    diagnostics = false;
    metrics = false;
  };
  vim_mode = true;
  buffer_font_size = 13.0;
  load_direnv = "direct";
  vertical_scroll_margin = 10;
  wrap_guides = [
    100
    120
  ];
  lsp = {
    rust-analyzer = {
      initialization_options = {
        check = {
          command = "clippy";
        };
        cargo = {
          targetDir = true;
        };
        workspace = {
          symbol = {
            search = {
              kind = "all_symbols";
              limit = 512;
            };
          };
        };
      };
    };
    nil = {
      initialization_options = {
        nix = {
          flake = {
            autoArchive = true;
          };
        };
      };
    };
  };
  which_key = {
    enabled = true;
  };
  preview_tabs = {
    enable_preview_from_file_finder = true;
  };
}
