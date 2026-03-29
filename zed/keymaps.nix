[
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
      "ctrl-l" = "vim::NextWordEnd";
      "ctrl-h" = "vim::PreviousWordStart";
      "ctrl-j" = "vim::EndOfParagraph";
      "ctrl-k" = "vim::StartOfParagraph";
      "ctrl-s" = "workspace::Save";
      "alt-tab" = "workspace::ActivateNextWindow";
      "cmd-shift-e" = "project_panel::Toggle";
    };
  }
  {
    context = "Editor";
    bindings = {
      "alt-l" = "editor::AcceptEditPrediction";
      "alt-L" = "editor::AcceptNextWordEditPrediction";
      "alt-j" = "editor::AcceptNextLineEditPrediction";
    };
  }
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

  {
    context = "Terminal";
    bindings = {
      "escape" = "terminal::ToggleViMode";
    };
  }
]
