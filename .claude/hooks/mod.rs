//! Claude Code hooks management
//!
//! This module handles Claude Code settings.json parsing and hook configuration,
//! specifically for managing the Stop hook that saves conversation transcripts.
//!
//! ## New Hooks Format (2025)
//!
//! Claude Code now uses a nested format with matchers:
//! ```json
//! {
//!   "hooks": {
//!     "Stop": [{
//!       "matcher": {},
//!       "hooks": [{"type": "command", "command": "..."}]
//!     }]
//!   }
//! }
//! ```

use crate::error::{Result, SilmariError};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

/// Claude Code settings.json structure
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeSettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<Permissions>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hooks: Option<Hooks>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_all_project_mcp_servers: Option<bool>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// Permissions configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Permissions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow: Option<Vec<String>>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// Hook configurations for Claude Code SDK events
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
pub struct Hooks {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop: Option<Vec<HookMatcher>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pre_tool_use: Option<Vec<HookMatcher>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub post_tool_use: Option<Vec<HookMatcher>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_prompt_submit: Option<Vec<HookMatcher>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pre_compact: Option<Vec<HookMatcher>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subagent_stop: Option<Vec<HookMatcher>>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// Hook matcher configuration (new format)
///
/// Each hook event contains an array of matchers, each with:
/// - `matcher`: conditions for when to trigger (can be empty `{}` for all events)
/// - `hooks`: array of actions to execute
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookMatcher {
    #[serde(default)]
    pub matcher: MatcherConfig,
    pub hooks: Vec<HookAction>,
}

/// Matcher configuration for filtering which events trigger hooks
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MatcherConfig {
    /// For tool hooks, filter by tool names
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<String>>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// Individual hook action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookAction {
    #[serde(rename = "type")]
    pub hook_type: String,
    pub command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<u32>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

impl HookAction {
    /// Create a new command hook action
    pub fn command(cmd: impl Into<String>) -> Self {
        Self {
            hook_type: "command".to_string(),
            command: cmd.into(),
            timeout: None,
            extra: HashMap::new(),
        }
    }
}

impl HookMatcher {
    /// Create a new hook matcher that matches all events
    pub fn match_all(actions: Vec<HookAction>) -> Self {
        Self {
            matcher: MatcherConfig::default(),
            hooks: actions,
        }
    }
}

impl ClaudeSettings {
    /// The command used in the Stop hook for transcript saving
    pub const TRANSCRIPT_HOOK_COMMAND: &'static str =
        r#"silmari-oracle transcript save "$TRANSCRIPT_PATH""#;

    /// Check if the transcript saving hook is already configured
    pub fn has_transcript_hook(&self) -> bool {
        self.hooks
            .as_ref()
            .and_then(|h| h.stop.as_ref())
            .map(|matchers| {
                matchers.iter().any(|m| {
                    m.hooks
                        .iter()
                        .any(|h| h.command.contains("silmari-oracle transcript save"))
                })
            })
            .unwrap_or(false)
    }

    /// Ensure the transcript saving hook is configured
    ///
    /// If the hook already exists, this is a no-op.
    /// Otherwise, it adds the hook to the Stop hooks list.
    pub fn ensure_transcript_hook(&mut self) {
        // Already has our hook
        if self.has_transcript_hook() {
            return;
        }

        let hook_action = HookAction::command(Self::TRANSCRIPT_HOOK_COMMAND);
        let hook_matcher = HookMatcher::match_all(vec![hook_action]);

        let hooks = self.hooks.get_or_insert_with(Hooks::default);
        let stop_hooks = hooks.stop.get_or_insert_with(Vec::new);
        stop_hooks.push(hook_matcher);
    }

    /// Load settings from a file path
    ///
    /// If the file doesn't exist, returns default settings.
    pub fn load_from_path(path: &Path) -> Result<Self> {
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = std::fs::read_to_string(path).map_err(|e| {
            SilmariError::Io(std::io::Error::new(
                e.kind(),
                format!("Failed to read settings from {}: {}", path.display(), e),
            ))
        })?;

        // Handle empty file
        if content.trim().is_empty() {
            return Ok(Self::default());
        }

        serde_json::from_str(&content).map_err(|e| {
            SilmariError::Json(serde_json::Error::io(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("Failed to parse settings from {}: {}", path.display(), e),
            )))
        })
    }

    /// Save settings to a file path
    ///
    /// Creates parent directories if they don't exist.
    pub fn save_to_path(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(self)?;
        std::fs::write(path, content)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    // ============================================
    // Behavior 1: Parse Claude Settings JSON (New Format)
    // ============================================

    #[test]
    fn test_parse_settings_with_new_hook_format() {
        let json = r#"{
            "permissions": {"allow": ["Bash(test)"]},
            "hooks": {
                "Stop": [{
                    "matcher": {},
                    "hooks": [{"type": "command", "command": "echo test"}]
                }]
            }
        }"#;

        let settings: ClaudeSettings = serde_json::from_str(json).unwrap();

        assert!(settings.hooks.is_some());
        let hooks = settings.hooks.unwrap();
        assert!(hooks.stop.is_some());
        let stop = hooks.stop.unwrap();
        assert_eq!(stop.len(), 1);
        assert_eq!(stop[0].hooks.len(), 1);
        assert_eq!(stop[0].hooks[0].command, "echo test");
    }

    #[test]
    fn test_parse_settings_with_tool_matcher() {
        let json = r#"{
            "hooks": {
                "PostToolUse": [{
                    "matcher": {"tools": ["Bash", "Read"]},
                    "hooks": [{"type": "command", "command": "echo tool used"}]
                }]
            }
        }"#;

        let settings: ClaudeSettings = serde_json::from_str(json).unwrap();

        let hooks = settings.hooks.unwrap();
        let post_tool = hooks.post_tool_use.unwrap();
        assert_eq!(post_tool[0].matcher.tools.as_ref().unwrap().len(), 2);
    }

    #[test]
    fn test_parse_settings_without_hooks() {
        let json = r#"{
            "permissions": {"allow": ["Bash(test)"]}
        }"#;

        let settings: ClaudeSettings = serde_json::from_str(json).unwrap();
        assert!(settings.hooks.is_none());
    }

    #[test]
    fn test_parse_empty_settings() {
        let json = "{}";
        let settings: ClaudeSettings = serde_json::from_str(json).unwrap();
        assert!(settings.hooks.is_none());
        assert!(settings.permissions.is_none());
    }

    #[test]
    fn test_parse_settings_preserves_extra_fields() {
        let json = r#"{
            "permissions": {"allow": ["Bash(test)"]},
            "customField": "custom value",
            "anotherField": 123
        }"#;

        let settings: ClaudeSettings = serde_json::from_str(json).unwrap();
        assert!(settings.extra.contains_key("customField"));
        assert!(settings.extra.contains_key("anotherField"));

        // Roundtrip should preserve
        let serialized = serde_json::to_string(&settings).unwrap();
        assert!(serialized.contains("customField"));
        assert!(serialized.contains("anotherField"));
    }

    #[test]
    fn test_parse_settings_with_enable_mcp_servers() {
        let json = r#"{
            "enableAllProjectMcpServers": true
        }"#;

        let settings: ClaudeSettings = serde_json::from_str(json).unwrap();
        assert_eq!(settings.enable_all_project_mcp_servers, Some(true));
    }

    #[test]
    fn test_load_from_nonexistent_path() {
        let temp = TempDir::new().unwrap();
        let path = temp.path().join("nonexistent.json");

        let settings = ClaudeSettings::load_from_path(&path).unwrap();
        assert!(settings.hooks.is_none());
        assert!(settings.permissions.is_none());
    }

    #[test]
    fn test_load_from_empty_file() {
        let temp = TempDir::new().unwrap();
        let path = temp.path().join("empty.json");
        std::fs::write(&path, "").unwrap();

        let settings = ClaudeSettings::load_from_path(&path).unwrap();
        assert!(settings.hooks.is_none());
    }

    // ============================================
    // Behavior 2: Add/Update Hooks in Settings (New Format)
    // ============================================

    #[test]
    fn test_add_transcript_hook_to_empty_settings() {
        let mut settings = ClaudeSettings::default();

        settings.ensure_transcript_hook();

        assert!(settings.has_transcript_hook());
        let hooks = settings.hooks.unwrap();
        let stop = hooks.stop.unwrap();
        assert_eq!(stop.len(), 1);
        assert_eq!(stop[0].hooks.len(), 1);
        assert!(stop[0].hooks[0]
            .command
            .contains("silmari-oracle transcript save"));
        assert_eq!(stop[0].hooks[0].hook_type, "command");
    }

    #[test]
    fn test_add_transcript_hook_preserves_existing_hooks() {
        let json = r#"{
            "hooks": {
                "Stop": [{
                    "matcher": {},
                    "hooks": [{"type": "command", "command": "echo existing"}]
                }],
                "PreToolUse": [{
                    "matcher": {},
                    "hooks": [{"type": "command", "command": "echo pre"}]
                }]
            }
        }"#;

        let mut settings: ClaudeSettings = serde_json::from_str(json).unwrap();
        settings.ensure_transcript_hook();

        let hooks = settings.hooks.unwrap();
        assert_eq!(hooks.stop.as_ref().unwrap().len(), 2); // existing + ours
        assert!(hooks.pre_tool_use.is_some()); // preserved
    }

    #[test]
    fn test_add_transcript_hook_no_duplicate() {
        let json = r#"{
            "hooks": {
                "Stop": [{
                    "matcher": {},
                    "hooks": [{"type": "command", "command": "silmari-oracle transcript save \"$TRANSCRIPT_PATH\""}]
                }]
            }
        }"#;

        let mut settings: ClaudeSettings = serde_json::from_str(json).unwrap();
        settings.ensure_transcript_hook();

        let hooks = settings.hooks.unwrap();
        assert_eq!(hooks.stop.unwrap().len(), 1); // no duplicate
    }

    #[test]
    fn test_has_transcript_hook_false_when_no_hooks() {
        let settings = ClaudeSettings::default();
        assert!(!settings.has_transcript_hook());
    }

    #[test]
    fn test_has_transcript_hook_false_when_different_hooks() {
        let json = r#"{
            "hooks": {
                "Stop": [{
                    "matcher": {},
                    "hooks": [{"type": "command", "command": "echo something else"}]
                }]
            }
        }"#;

        let settings: ClaudeSettings = serde_json::from_str(json).unwrap();
        assert!(!settings.has_transcript_hook());
    }

    #[test]
    fn test_save_and_load_roundtrip() {
        let temp = TempDir::new().unwrap();
        let path = temp.path().join(".claude/settings.json");

        let mut settings = ClaudeSettings::default();
        settings.ensure_transcript_hook();

        settings.save_to_path(&path).unwrap();

        let loaded = ClaudeSettings::load_from_path(&path).unwrap();
        assert!(loaded.has_transcript_hook());
    }

    #[test]
    fn test_save_creates_parent_directories() {
        let temp = TempDir::new().unwrap();
        let path = temp.path().join("nested/deep/settings.json");

        let settings = ClaudeSettings::default();
        settings.save_to_path(&path).unwrap();

        assert!(path.exists());
    }

    #[test]
    fn test_serialized_format_matches_expected() {
        let mut settings = ClaudeSettings::default();
        settings.ensure_transcript_hook();

        let serialized = serde_json::to_string_pretty(&settings).unwrap();

        // Verify the new format structure
        assert!(serialized.contains("\"matcher\""));
        assert!(serialized.contains("\"hooks\""));
        assert!(serialized.contains("\"type\": \"command\""));
        assert!(serialized.contains("silmari-oracle transcript save"));
    }
}
