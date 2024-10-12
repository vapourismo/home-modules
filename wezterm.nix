{
  config,
  lib,
  pkgs,
  ...
}: {
  options.ole.terminal = {
    font = lib.mkOption {
      type = lib.types.str;
      default = "Iosevka Term SS02";
    };

    fontSize = lib.mkOption {
      type = lib.types.numbers.positive;
      default = 13;
    };
  };

  config.programs.wezterm = {
    enable = true;

    package = pkgs.wezterm;

    extraConfig = ''
      local wezterm = require('wezterm')

      function scheme_for_appearance(appearance)
        if appearance:find("Dark") then
          return "ayu"
        else
          return "Everforest Light (Gogh)"
        end
      end

      wezterm.on("window-config-reloaded", function(window, pane)
        local overrides = window:get_config_overrides() or {}
        local appearance = window:get_appearance()
        local scheme = scheme_for_appearance(appearance)
        if overrides.color_scheme ~= scheme then
          overrides.color_scheme = scheme
          window:set_config_overrides(overrides)
        end
      end)

      return {
        font = wezterm.font('${config.ole.terminal.font}'),
        font_size = ${builtins.toString config.ole.terminal.fontSize},

        enable_tab_bar = false,
        use_fancy_tab_bar = false,

        native_macos_fullscreen_mode = true,

        exit_behavior = "Close",

        check_for_updates = false,

        color_scheme = 'ayu',

        inactive_pane_hsb = {
          saturation = 0.7,
          brightness = 0.8,
        },

        underline_thickness = 2,
        underline_position = -4,

        window_padding = {
          left = 0,
          right = 0,
          top = 0,
          bottom = 0,
        },

        use_ime = true,

        audible_bell = "Disabled",

        quick_select_patterns = {
          "[^\\s(){}\\[\\]]{4,64}",
        },

        leader = { mods = 'CTRL', key = 'a' },

        keys = {
          {mods = "LEADER|CTRL", key = "a", action = wezterm.action.SendString "\x01"},
          {mods = "LEADER", key = "h", action = wezterm.action({ActivatePaneDirection = "Left"})},
          {mods = "CMD", key = "h", action = wezterm.action({ActivatePaneDirection = "Left"})},
          {mods = "LEADER", key = "j", action = wezterm.action({ActivatePaneDirection = "Down"})},
          {mods = "CMD", key = "j", action = wezterm.action({ActivatePaneDirection = "Down"})},
          {mods = "LEADER", key = "k", action = wezterm.action({ActivatePaneDirection = "Up"})},
          {mods = "CMD", key = "k", action = wezterm.action({ActivatePaneDirection = "Up"})},
          {mods = "LEADER", key = "l", action = wezterm.action({ActivatePaneDirection = "Right"})},
          {mods = "CMD", key = "l", action = wezterm.action({ActivatePaneDirection = "Right"})},
          {mods = "LEADER|SHIFT", key = "h", action = wezterm.action({AdjustPaneSize = {"Left", 1}})},
          {mods = "CMD|SHIFT", key = "h", action = wezterm.action({AdjustPaneSize = {"Left", 1}})},
          {mods = "LEADER|SHIFT", key = "j", action = wezterm.action({AdjustPaneSize = {"Down", 1}})},
          {mods = "CMD|SHIFT", key = "j", action = wezterm.action({AdjustPaneSize = {"Down", 1}})},
          {mods = "LEADER|SHIFT", key = "k", action = wezterm.action({AdjustPaneSize = {"Up", 1}})},
          {mods = "CMD|SHIFT", key = "k", action = wezterm.action({AdjustPaneSize = {"Up", 1}})},
          {mods = "LEADER|SHIFT", key = "l", action = wezterm.action({AdjustPaneSize = {"Right", 1}})},
          {mods = "CMD|SHIFT", key = "l", action = wezterm.action({AdjustPaneSize = {"Right", 1}})},
          {mods = "LEADER", key = "v", action = wezterm.action({SplitHorizontal = {domain = "CurrentPaneDomain"}})},
          {mods = "LEADER", key = "s", action = wezterm.action({SplitVertical = {domain = "CurrentPaneDomain"}})},
          {mods = "LEADER", key = "c", action = wezterm.action.SpawnTab("CurrentPaneDomain")},
          {mods = "LEADER", key = "p", action = wezterm.action.ActivateTabRelative(-1) },
          {mods = "LEADER", key = "n", action = wezterm.action.ActivateTabRelative(1) },
          {mods = "LEADER", key = "1", action = wezterm.action.ActivateTab(0) },
          {mods = "LEADER", key = "2", action = wezterm.action.ActivateTab(1) },
          {mods = "LEADER", key = "3", action = wezterm.action.ActivateTab(2) },
          {mods = "LEADER", key = "4", action = wezterm.action.ActivateTab(3) },
          {mods = "LEADER", key = "5", action = wezterm.action.ActivateTab(4) },
          {mods = "LEADER", key = "6", action = wezterm.action.ActivateTab(5) },
          {mods = "LEADER", key = "7", action = wezterm.action.ActivateTab(6) },
          {mods = "LEADER", key = "8", action = wezterm.action.ActivateTab(7) },
          {mods = "LEADER", key = "9", action = wezterm.action.ActivateTab(8) },
          {mods = "LEADER", key = "0", action = wezterm.action.ActivateTab(9) },
          {mods = "CMD", key = "s", action = "QuickSelect"},
          {mods = "ALT", key = "1", action = wezterm.action.ActivateTab(0) },
          {mods = "ALT", key = "2", action = wezterm.action.ActivateTab(1) },
          {mods = "ALT", key = "3", action = wezterm.action.ActivateTab(2) },
          {mods = "ALT", key = "4", action = wezterm.action.ActivateTab(3) },
          {mods = "ALT", key = "5", action = wezterm.action.ActivateTab(4) },
          {mods = "ALT", key = "6", action = wezterm.action.ActivateTab(5) },
          {mods = "ALT", key = "7", action = wezterm.action.ActivateTab(6) },
          {mods = "ALT", key = "8", action = wezterm.action.ActivateTab(7) },
          {mods = "ALT", key = "9", action = wezterm.action.ActivateTab(8) },
          {mods = "ALT", key = "0", action = wezterm.action.ActivateTab(9) },
        }
      }
    '';
  };
}
