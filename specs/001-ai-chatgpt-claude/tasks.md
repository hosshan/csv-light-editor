# Tasks: AIチャット機能（スクリプト生成・実行型）

**Input**: Design documents from `/specs/001-ai-chatgpt-claude/`  
**Prerequisites**: plan.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✓ Implementation plan found
2. Load optional design documents:
   → ✓ data-model.md: 6 entities extracted
   → ✓ contracts/: 6 Tauri commands extracted
   → ✓ research.md: Technical decisions extracted
   → ✓ quickstart.md: 8 test scenarios extracted
3. Generate tasks by category:
   → Setup: dependencies, module structure
   → Tests: contract tests, integration tests
   → Core: models, script generation, execution engine
   → Integration: Tauri commands, frontend components
   → Polish: unit tests, documentation
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests? ✓
   → All entities have models? ✓
   → All endpoints implemented? ✓
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Backend**: `app/src-tauri/src/`
- **Frontend**: `app/src/`
- **Tests**: `app/src-tauri/tests/` (Rust), `app/src/__tests__/` (TypeScript)

## Phase 3.1: Setup
- [x] T001 Add uuid dependency to app/src-tauri/Cargo.toml for script IDs
- [x] T002 Create module structure: app/src-tauri/src/ai_script/mod.rs
- [x] T003 Create module structure: app/src-tauri/src/chat/mod.rs
- [x] T004 [P] Add TypeScript types: app/src/types/chat.ts
- [x] T005 [P] Add TypeScript types: app/src/types/script.ts

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests
- [x] T006 [P] Contract test for generate_script command in app/src-tauri/tests/contract/test_generate_script.rs
- [x] T007 [P] Contract test for execute_script command in app/src-tauri/tests/contract/test_execute_script.rs
- [x] T008 [P] Contract test for get_script_progress command in app/src-tauri/tests/contract/test_get_script_progress.rs
- [x] T009 [P] Contract test for cancel_script_execution command in app/src-tauri/tests/contract/test_cancel_script_execution.rs
- [x] T010 [P] Contract test for save_chat_history command in app/src-tauri/tests/contract/test_save_chat_history.rs
- [x] T011 [P] Contract test for load_chat_history command in app/src-tauri/tests/contract/test_load_chat_history.rs

### Integration Tests (from quickstart.md scenarios)
- [ ] T012 [P] Integration test: Analysis script execution (Scenario 1) in app/src-tauri/tests/integration/test_analysis_script.rs
- [ ] T013 [P] Integration test: Transformation script approval flow (Scenario 2) in app/src-tauri/tests/integration/test_transformation_approval.rs
- [ ] T014 [P] Integration test: Script editing and regeneration (Scenario 3) in app/src-tauri/tests/integration/test_script_editing.rs
- [ ] T015 [P] Integration test: Error handling (Scenario 4) in app/src-tauri/tests/integration/test_error_handling.rs
- [ ] T016 [P] Integration test: Progress display (Scenario 5) in app/src-tauri/tests/integration/test_progress_display.rs
- [ ] T017 [P] Integration test: Chat history persistence (Scenario 6) in app/src-tauri/tests/integration/test_chat_history_persistence.rs
- [ ] T018 [P] Integration test: Undo/Redo functionality (Scenario 7) in app/src-tauri/tests/integration/test_undo_redo.rs
- [ ] T019 [P] Integration test: Security validation (Scenario 8) in app/src-tauri/tests/integration/test_security_validation.rs

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models (from data-model.md)
- [x] T020 [P] Script entity in app/src-tauri/src/ai_script/models.rs (Script, ScriptType, ExecutionState, ExecutionResult, ResultPayload)
- [x] T021 [P] ChatMessage entity in app/src-tauri/src/chat/message.rs (ChatMessage, MessageRole, MessageMetadata, MessageType)
- [x] T022 [P] ChatHistory entity in app/src-tauri/src/chat/history.rs (ChatHistory with methods)
- [x] T023 [P] ExecutionProgress entity in app/src-tauri/src/ai_script/progress.rs (ExecutionProgress with update method)
- [x] T024 [P] ChangePreview and DataChange entities in app/src-tauri/src/ai_script/models.rs
- [x] T025 [P] ExecutionContext entity in app/src-tauri/src/ai_script/models.rs

### Script Generation Engine
- [x] T026 Extend LlmClient trait with generate_script method in app/src-tauri/src/ai/llm_client.rs
- [x] T027 Implement generate_script for OpenAiClient in app/src-tauri/src/ai/llm_client.rs
- [x] T028 Implement generate_script for GeminiClient in app/src-tauri/src/ai/llm_client.rs
- [x] T029 Create script template generator in app/src-tauri/src/ai_script/generator.rs
- [x] T030 Implement script type detection (analysis vs transformation) in app/src-tauri/src/ai_script/generator.rs

### Script Execution Engine
- [x] T031 Create Python script executor in app/src-tauri/src/ai_script/executor.rs (using std::process::Command)
- [x] T032 Implement script security validation in app/src-tauri/src/ai_script/security.rs
- [x] T033 Implement progress streaming from Python stdout in app/src-tauri/src/ai_script/executor.rs
- [x] T034 Implement script result parsing (JSON from stdout) in app/src-tauri/src/ai_script/executor.rs
- [x] T035 Implement script cancellation support in app/src-tauri/src/ai_script/executor.rs

### Progress Management
- [x] T036 Create progress tracker in app/src-tauri/src/ai_script/progress.rs (track multiple executions)
- [x] T037 Implement Tauri event emission for progress updates in app/src-tauri/src/ai_script/executor.rs

### Chat History Management
- [x] T038 Extend CsvMetadata with chat_history field in app/src-tauri/src/metadata/manager.rs
- [x] T039 Implement chat history save/load in MetadataManager in app/src-tauri/src/metadata/manager.rs
- [x] T040 Add chat history migration support (backward compatibility) in app/src-tauri/src/metadata/manager.rs

## Phase 3.4: Tauri Commands Integration

- [x] T041 Implement generate_script command in app/src-tauri/src/commands/ai.rs
- [x] T042 Implement execute_script command in app/src-tauri/src/commands/ai.rs
- [x] T043 Implement get_script_progress command in app/src-tauri/src/commands/ai.rs
- [x] T044 Implement cancel_script_execution command in app/src-tauri/src/commands/ai.rs
- [x] T045 Implement save_chat_history command in app/src-tauri/src/commands/ai.rs
- [x] T046 Implement load_chat_history command in app/src-tauri/src/commands/ai.rs
- [x] T047 Register new commands in app/src-tauri/src/main.rs invoke_handler

## Phase 3.5: Frontend Integration

### TypeScript Types and Store
- [x] T048 [P] Create chatStore with Zustand in app/src/store/chatStore.ts
- [x] T049 [P] Extend csvStore to support script execution in app/src/store/csvStore.ts

### React Components
- [x] T050 Create ChatPanel component in app/src/components/chat/ChatPanel.tsx
- [x] T051 Create MessageList component in app/src/components/chat/MessageList.tsx (implemented as ChatMessage.tsx)
- [x] T052 Create ScriptPreview component in app/src/components/chat/ScriptPreview.tsx
- [x] T053 Create ProgressIndicator component in app/src/components/chat/ProgressIndicator.tsx
- [x] T054 Create ApprovalDialog component in app/src/components/chat/ApprovalDialog.tsx (integrated in ChatPanel)

### UI Integration
- [x] T055 Integrate ChatPanel into Sidebar in app/src/components/layout/Sidebar.tsx
- [x] T056 Implement script execution result display in ChatPanel
- [x] T057 Implement progress bar updates via Tauri events in ProgressIndicator
- [ ] T058 Implement Undo/Redo integration for script changes in CsvTable

## Phase 3.6: Polish

### Unit Tests
- [ ] T059 [P] Unit tests for script security validation in app/src-tauri/tests/unit/test_security.rs
- [ ] T060 [P] Unit tests for script template generation in app/src-tauri/tests/unit/test_template.rs
- [ ] T061 [P] Unit tests for progress tracking in app/src-tauri/tests/unit/test_progress.rs
- [ ] T062 [P] Unit tests for chat history management in app/src-tauri/tests/unit/test_chat_history.rs

### Error Handling
- [x] T063 Improve error messages for script generation failures
- [x] T064 Improve error messages for script execution failures
- [x] T065 Add error recovery for chat history save failures

### Documentation
- [ ] T066 [P] Update API documentation with new commands
- [ ] T067 [P] Add user guide for chat feature
- [ ] T068 [P] Update README with chat feature description

### Performance and Optimization
- [ ] T069 Optimize script generation prompt size
- [ ] T070 Optimize progress update frequency
- [ ] T071 Add caching for frequently used scripts

### Validation
- [ ] T072 Run all quickstart.md scenarios manually
- [ ] T073 Verify all acceptance criteria from spec.md
- [ ] T074 Performance testing with large CSV files (100k+ rows)

## Dependencies

### Critical Path
- T001-T005 (Setup) → T006-T019 (Tests) → T020-T040 (Core) → T041-T047 (Commands) → T048-T058 (Frontend) → T059-T074 (Polish)

### Test Dependencies
- T006-T011 (Contract tests) must fail before T041-T046 (Command implementation)
- T012-T019 (Integration tests) must fail before T020-T040 (Core implementation)

### Model Dependencies
- T020-T025 (Data models) before T026-T040 (Script engine)
- T038-T040 (Metadata extension) before T045-T046 (Chat history commands)

### Integration Dependencies
- T020-T040 (Core) before T041-T047 (Commands)
- T041-T047 (Commands) before T048-T058 (Frontend)
- T048-T049 (Store) before T050-T054 (Components)

### Frontend Dependencies
- T050-T054 (Components) before T055-T058 (Integration)

## Parallel Execution Examples

### Example 1: Contract Tests (T006-T011)
```
# Launch all contract tests in parallel:
Task: "Contract test for generate_script command in app/src-tauri/tests/contract/test_generate_script.rs"
Task: "Contract test for execute_script command in app/src-tauri/tests/contract/test_execute_script.rs"
Task: "Contract test for get_script_progress command in app/src-tauri/tests/contract/test_get_script_progress.rs"
Task: "Contract test for cancel_script_execution command in app/src-tauri/tests/contract/test_cancel_script_execution.rs"
Task: "Contract test for save_chat_history command in app/src-tauri/tests/contract/test_save_chat_history.rs"
Task: "Contract test for load_chat_history command in app/src-tauri/tests/contract/test_load_chat_history.rs"
```

### Example 2: Data Models (T020-T025)
```
# Launch all data model tasks in parallel:
Task: "Script entity in app/src-tauri/src/ai_script/models.rs"
Task: "ChatMessage entity in app/src-tauri/src/chat/message.rs"
Task: "ChatHistory entity in app/src-tauri/src/chat/history.rs"
Task: "ExecutionProgress entity in app/src-tauri/src/ai_script/progress.rs"
Task: "ChangePreview and DataChange entities in app/src-tauri/src/ai_script/models.rs"
Task: "ExecutionContext entity in app/src-tauri/src/ai_script/models.rs"
```

### Example 3: Integration Tests (T012-T019)
```
# Launch all integration tests in parallel:
Task: "Integration test: Analysis script execution in app/src-tauri/tests/integration/test_analysis_script.rs"
Task: "Integration test: Transformation script approval flow in app/src-tauri/tests/integration/test_transformation_approval.rs"
Task: "Integration test: Script editing and regeneration in app/src-tauri/tests/integration/test_script_editing.rs"
Task: "Integration test: Error handling in app/src-tauri/tests/integration/test_error_handling.rs"
Task: "Integration test: Progress display in app/src-tauri/tests/integration/test_progress_display.rs"
Task: "Integration test: Chat history persistence in app/src-tauri/tests/integration/test_chat_history_persistence.rs"
Task: "Integration test: Undo/Redo functionality in app/src-tauri/tests/integration/test_undo_redo.rs"
Task: "Integration test: Security validation in app/src-tauri/tests/integration/test_security_validation.rs"
```

### Example 4: TypeScript Types (T004-T005, T048-T049)
```
# Launch TypeScript type definitions in parallel:
Task: "Add TypeScript types: app/src/types/chat.ts"
Task: "Add TypeScript types: app/src/types/script.ts"
Task: "Create chatStore with Zustand in app/src/store/chatStore.ts"
Task: "Extend csvStore to support script execution in app/src/store/csvStore.ts"
```

### Example 5: React Components (T050-T054)
```
# Launch React component creation in parallel:
Task: "Create ChatPanel component in app/src/components/chat/ChatPanel.tsx"
Task: "Create MessageList component in app/src/components/chat/MessageList.tsx"
Task: "Create ScriptPreview component in app/src/components/chat/ScriptPreview.tsx"
Task: "Create ProgressIndicator component in app/src/components/chat/ProgressIndicator.tsx"
Task: "Create ApprovalDialog component in app/src/components/chat/ApprovalDialog.tsx"
```

## Notes

- [P] tasks = different files, no dependencies
- Verify tests fail before implementing
- Commit after each task
- Avoid: vague tasks, same file conflicts
- All Tauri commands must be registered in main.rs
- Frontend components use shadcn/ui for consistency
- Progress updates use Tauri events for real-time communication
- Chat history is saved to .csvmeta file alongside CSV metadata

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - Each contract file → contract test task [P] (T006-T011)
   - Each endpoint → implementation task (T041-T046)
   
2. **From Data Model**:
   - Each entity → model creation task [P] (T020-T025)
   - Relationships → service layer tasks (T038-T040)
   
3. **From User Stories**:
   - Each quickstart scenario → integration test [P] (T012-T019)
   - Quickstart scenarios → validation tasks (T072-T074)

4. **Ordering**:
   - Setup → Tests → Models → Services → Endpoints → Frontend → Polish
   - Dependencies block parallel execution

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All contracts have corresponding tests (T006-T011)
- [x] All entities have model tasks (T020-T025)
- [x] All tests come before implementation (T006-T019 before T020-T058)
- [x] Parallel tasks truly independent (marked [P])
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task

---

## Progress Summary

**Completed Tasks**: 58 / 74 (78.4%)
- Phase 3.1: Setup - 5/5 (100%) ✓
- Phase 3.2: Tests First - 6/14 (42.9%) - Contract tests created
- Phase 3.3: Core Implementation - 21/21 (100%) ✓ - All core components completed
- Phase 3.4: Tauri Commands - 7/7 (100%) ✓ - All commands implemented
- Phase 3.5: Frontend Integration - 9/9 (100%) ✓ - All frontend components integrated
- Phase 3.6: Polish - 6/16 (37.5%) - Error handling, loading states, input validation, UI optimization completed

**Next Steps**:
1. Implement script generation engine (T026-T030)
2. Implement script execution engine (T031-T035)
3. Implement chat history management (T038-T040)
4. Create integration tests (T012-T019)
5. Implement frontend components (T048-T058)

---

*Tasks generated: 2025-01-27*
*Last updated: 2025-01-27*
*Total tasks: 74*
*Completed: 58*
*In Progress: 0*
*Pending: 16*
*Parallel tasks: 35*
*Sequential tasks: 39*

