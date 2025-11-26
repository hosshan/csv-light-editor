# Rust Style Guide

## Serde Naming Convention

### Rule: Always use `#[serde(rename_all = "camelCase")]` for JSON serialization

All structs and enums that are serialized to JSON (for Tauri commands, responses, or any frontend communication) **MUST** use `#[serde(rename_all = "camelCase")]`.

#### ✅ Correct

```rust
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserData {
    pub first_name: String,      // JSON: firstName
    pub last_name: String,        // JSON: lastName
    pub email_address: String,    // JSON: emailAddress
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiResponse {
    pub user_id: String,          // JSON: userId
    pub created_at: DateTime<Utc>, // JSON: createdAt
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ResponsePayload {
    Success {
        data_count: usize,        // JSON: dataCount
    },
    Error {
        error_message: String,    // JSON: errorMessage
    },
}
```

#### ❌ Incorrect

```rust
// Missing #[serde(rename_all = "camelCase")]
#[derive(Debug, Serialize, Deserialize)]
pub struct UserData {
    pub first_name: String,       // JSON: first_name (snake_case - WRONG!)
    pub last_name: String,
}
```

### Why?

1. **Language Conventions**: Rust uses `snake_case`, JavaScript/TypeScript uses `camelCase`
2. **Tauri Design**: Tauri automatically converts command **arguments** to camelCase, but **NOT** response data
3. **Consistency**: Frontend expects camelCase everywhere for a natural JavaScript API
4. **Best Practice**: Officially recommended by Tauri documentation

### Checklist

When creating a new struct or enum:

- [ ] Does it implement `Serialize` or `Deserialize`?
- [ ] Will it be sent to/from the frontend?
- [ ] Have I added `#[serde(rename_all = "camelCase")]`?

### Exceptions

- Internal Rust-only structs (not serialized to JSON) don't need this attribute
- Enums with `#[serde(rename_all = "lowercase")]` for simple variants (e.g., `User`, `Admin` → `user`, `admin`)
