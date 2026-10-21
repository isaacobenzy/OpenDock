use serde_json::Value;

/// Replaces `{{field}}` placeholders with values from an event payload.
/// Mirrors `renderTemplate` in `@opendock/config-schema`.
pub fn render(text: &str, payload: &Value) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(start) = rest.find("{{") {
        out.push_str(&rest[..start]);
        let after = &rest[start + 2..];
        let Some(end) = after.find("}}") else {
            out.push_str(&rest[start..]);
            return out;
        };
        let key = after[..end].trim();
        if is_key(key) {
            out.push_str(&display(payload.get(key)));
        } else {
            out.push_str(&rest[start..start + 2 + end + 2]);
        }
        rest = &after[end + 2..];
    }
    out.push_str(rest);
    out
}

fn is_key(key: &str) -> bool {
    !key.is_empty() && key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
}

pub fn display(value: Option<&Value>) -> String {
    match value {
        None | Some(Value::Null) => String::new(),
        Some(Value::String(s)) => s.clone(),
        Some(Value::Number(n)) => match n.as_f64() {
            Some(f) if f.fract() == 0.0 && f.abs() < 1e15 => format!("{}", f as i64),
            Some(f) => format!("{f:.1}"),
            None => n.to_string(),
        },
        Some(other) => other.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn renders_known_and_missing_fields() {
        let payload = json!({ "title": "Standup", "minutesUntil": 5.0 });
        assert_eq!(
            render("{{title}} in {{ minutesUntil }} min{{missing}}", &payload),
            "Standup in 5 min"
        );
    }

    #[test]
    fn leaves_malformed_placeholders() {
        assert_eq!(render("a {{ b", &json!({})), "a {{ b");
        assert_eq!(render("{{a b}}", &json!({})), "{{a b}}");
    }
}
