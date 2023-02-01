{
  pkgs,
  specialArgs,
  ...
}: {
  programs.helix = {
    enable = true;
    package = specialArgs.inputs.helix.packages.${pkgs.system}.default;
    settings = {
      theme = "ole";
      editor = {
        rulers = [100 120];
        bufferline = "always";
        cursorline = true;
        auto-save = true;
        auto-format = true;
        color-modes = true;
        idle-timeout = 0;
        indent-guides = {
          render = true;
          character = "▏";
          skip-levels = 0;
        };
        cursor-shape = {
          insert = "bar";
          normal = "block";
          select = "block";
        };
        statusline = {
          left = ["mode" "spinner" "diagnostics"];
          center = [];
          right = ["file-name" "separator" "position"];
          mode = {
            normal = "NORMAL";
            insert = "INSERT";
            select = "SELECT";
          };
        };
      };
      keys = {
        insert = {
          C-s = ":w";
        };
        normal = {
          C-s = ":w";
          C-j = ["goto_next_paragraph" "collapse_selection"];
          C-k = ["goto_prev_paragraph" "collapse_selection"];
          C-h = "move_prev_word_start";
          C-l = "move_next_word_end";
          g = {
            j = ["goto_next_paragraph" "collapse_selection"];
            k = ["goto_prev_paragraph" "collapse_selection"];
          };
          space = {
            c = ":bc";
            space = {
              q = ":qa";
              r = ":config-reload";
              c = ":config-open";
            };
          };
        };
        select = {
          C-j = "goto_next_paragraph";
          C-k = "goto_prev_paragraph";
          C-h = "extend_prev_word_start";
          C-l = "extend_next_word_end";
          v = [];
        };
      };
    };
    languages = [
      {
        name = "ocaml";
        auto-format = true;
      }
      {
        name = "ocaml-interface";
        auto-format = true;
      }
      {
        name = "nix";
        auto-format = true;
        config.nil.formatting.command = ["alejandra"];
      }
    ];
    themes = {
      ole = {
        "ui.background" = {
          fg = "contrast2";
          bg = "contrast1";
        };
        "ui.background.separator" = {
          fg = "contrast2";
          bg = "contrast1";
        };
        "ui.cursor" = {
          bg = "accent1";
          fg = "#1c1e26";
        };
        "ui.cursor.match" = {
          fg = "accent1";
          underline = {style = "line";};
        };
        "ui.gutter" = {};
        "ui.gutter.selected" = {};
        "ui.linenr" = "accent2";
        "ui.linenr.selected" = "accent1";
        "ui.statusline" = {bg = "contrast3";};
        "ui.statusline.inactive" = {bg = "contrast3";};
        "ui.statusline.normal" = {
          bg = "white";
          fg = "black";
        };
        "ui.statusline.insert" = {
          bg = "green";
          fg = "black";
        };
        "ui.statusline.select" = {
          bg = "blue";
          fg = "black";
        };
        "ui.statusline.separator" = {};
        "ui.popup" = {bg = "contrast4";};
        "ui.popup.info" = {bg = "contrast4";};
        "ui.window" = {fg = "contrast4";};
        "ui.help" = {bg = "contrast4";};
        "ui.text" = {};
        "ui.text.focus" = {};
        "ui.text.info" = {};
        "ui.virtual.ruler" = {bg = "contrast3";};
        "ui.virtual.whitespace" = {};
        "ui.virtual.indent-guide" = {fg = "#333333";};
        "ui.menu" = {bg = "contrast4";};
        "ui.menu.selected" = {
          fg = "contrast4";
          bg = "contrast2";
        };
        "ui.menu.scroll" = {
          fg = "contrast2";
          bg = "contrast4";
        };
        "ui.selection" = {bg = "#3f404e";};
        "ui.cursorline.primary" = {bg = "contrast5";};
        "ui.cursorline.secondary" = {bg = "contrast5";};
        "ui.bufferline" = {bg = "contrast3";};
        "ui.bufferline.active" = {bg = "accent2";};
        "warning" = "yellow";
        "error" = "red";
        "info" = "blue";
        "hint" = "blue";
        "diagnostic.hint" = {
          underline = {
            color = "blue";
            style = "curl";
          };
        };
        "diagnostic.info" = {
          underline = {
            color = "blue";
            style = "curl";
          };
        };
        "diagnostic.warning" = {
          underline = {
            color = "yellow";
            style = "curl";
          };
        };
        "diagnostic.error" = {
          underline = {
            color = "red";
            style = "curl";
          };
        };
        "comment" = "#666666";
        "constant" = "#88A04A";
        "string" = "#88A04A";
        "function" = "#6699CC";
        "constructor" = "#6699CC";
        "keyword" = "#B14744";
        "operator" = "#B14744";
        "type" = "#D69876";
        "keyword.storage.modifier" = "#A5346D";
        "diff.plus" = "#449944";
        "diff.minus" = "#993333";
        palette = {
          contrast1 = "#1a1a1a";
          contrast2 = "#ffffff";
          contrast3 = "#1f1f1f";
          contrast4 = "#232530";
          contrast5 = "#202020";
          accent1 = "#e95378";
          accent2 = "#6699cc";
          blue = "#59c2ff";
          dark_gray = "#2d3640";
          cyan = "#73b8ff";
          gray = "#5c6773";
          green = "#aad94c";
          magenta = "#d2a6ff";
          orange = "#ff8f40";
          red = "#f07178";
          yellow = "#e6b450";
        };
      };
    };
  };
}
