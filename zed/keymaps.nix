[
  # Window movements
  {
    bindings = {
      "cmd-§" = "terminal_panel::Toggle";
      "cmd-h" = "workspace::ActivatePaneLeft";
      "cmd-l" = "workspace::ActivatePaneRight";
      "cmd-j" = "workspace::ActivatePaneDown";
      "cmd-k" = "workspace::ActivatePaneUp";
      "cmd-H" = "vim::ResizePaneRight";
      "cmd-J" = "vim::ResizePaneDown";
      "cmd-K" = "vim::ResizePaneUp";
      "cmd-L" = "vim::ResizePaneLeft";
      "ctrl-s" = "workspace::Save";
      "alt-tab" = "workspace::ActivateNextWindow";
      "cmd-shift-e" = "project_panel::Toggle";
      "cmd-r" = "agent::Toggle";
    };
  }

  # Text editing movements
  {
    context = "Editor";
    bindings = {
      "alt-l" = "editor::AcceptEditPrediction";
      "alt-L" = "editor::AcceptNextWordEditPrediction";
      "alt-j" = "editor::AcceptNextLineEditPrediction";
      "alt-J" = "editor::AddSelectionBelow";
      "alt-K" = "editor::AddSelectionAbove";
      "ctrl-l" = "vim::NextWordEnd";
      "ctrl-h" = "vim::PreviousWordStart";
      "ctrl-j" = "vim::EndOfParagraph";
      "ctrl-k" = "vim::StartOfParagraph";
      "cmd-d" = "editor::SelectNext";
      "cmd-shift-d" = [
        "editor::SelectNext"
        { "replace_newest" = true; }
      ];

    };
  }

  # Selection in menus
  {
    context = "Editor && (showing_code_actions || showing_completions)";
    bindings = {
      "ctrl-j" = "editor::ContextMenuNext";
      "ctrl-k" = "editor::ContextMenuPrevious";
    };
  }
  {
    context = "(CommandPalette > Editor) || (Picker > Editor)";
    bindings = {
      "ctrl-j" = "menu::SelectNext";
      "ctrl-k" = "menu::SelectPrevious";
    };
  }

  # Normal mode bindings
  {
    context = "(Workspace && !Editor && !Terminal) || (VimControl && vim_mode != insert)";
    bindings = {
      "U" = "editor::Redo";
      "space a" = "editor::ToggleCodeActions";
      "space k" = "editor::Hover";
      "space D" = "diagnostics::Deploy";
      "space d" = "diagnostics::DeployCurrentFile";
      "space S" = "project_symbols::Toggle";
      "space s" = "outline::Toggle";
      "space f" = "file_finder::Toggle";
      "space F" = "projects::OpenRecent";
      "space /" = "pane::DeploySearch";
      "space r" = "editor::Rename";
      "space b" = "tab_switcher::OpenInActivePane";
      "g l" = "vim::EndOfLineDownward";
      "g s" = "vim::StartOfLineDownward";
      "g j" = "editor::GoToDiagnostic";
      "g k" = "editor::GoToPreviousDiagnostic";
      "g h" = "vim::StartOfLine";
      "b q" = "pane::CloseActiveItem";
      "b Q" = "workspace::CloseAllItemsAndPanes";
      "g r j" = "vim::GoToNextReference";
      "g r k" = "vim::GoToPreviousReference";
    };
  }

  # Terminal shortcuts
  {
    context = "Terminal";
    bindings = {
      "escape" = "terminal::ToggleViMode";
      "cmd-escape" = [
        "terminal::SendKeystroke"
        "escape"
      ];
    };
  }

  # TabSwitcher
  {
    context = "TabSwitcher";
    bindings = {
      "ctrl-x" = "tab_switcher::CloseSelectedItem";
    };
  }

  # Unbind "r" in Normal mode to avoid triggering Replace mode
  {
    context = "vim_mode == normal || vim_mode == helix_normal || vim_mode == visual";
    unbind = {
      "r" = "vim::PushReplace";
    };
  }
  {
    context = "VimControl && !menu";
    unbind = {
      "shift-r" = "vim::ToggleReplace";
    };
  }
  {
    context = "vim_mode == visual";
    unbind = {
      "shift-r" = "vim::SubstituteLine";
    };
  }
  {
    context = "vim_operator == gR";
    unbind = {
      "shift-r" = "vim::CurrentLine";
    };
  }

  # Unbind "tab" in edit prediction mode to avoid accepting predictions when completing
  {
    context = "Editor && edit_prediction && edit_prediction_mode == eager && !showing_completions";
    unbind = {
      "tab" = "editor::AcceptEditPrediction";
    };
  }
]
