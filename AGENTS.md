# AGENTS.md

## 代码注释禁止（Code comments are forbidden）

- **严禁**在任何源代码文件中编写注释，这是硬性规则。
- 禁止的注释形式包括但不限于：
  - JavaScript / TypeScript：`//`、`/* */`、`/** */`（JSDoc）
  - CSS：`/* */`
  - HTML/XML：`<!-- -->`
  - Python：`#`
  - Shell：`#`
  - 测试文件、脚本文件同样适用
- 不要写解释性注释、行内注释、文件头注释、TODO 注释、调试注释。
- 需要文档说明时，写入 README.md 或 AGENTS.md（文档文件不受此规则限制）。
- 保持代码简洁；用清晰的命名替代注释。

## 文件大小限制（File size limit）

- 每个源文件不得超过 20 KB。
- 超过 20 KB 的文件必须拆分为多个更小的文件。
- 每个文件只承担一个职责。

## Git 提交规则（Git policy）

- 每个完成的任务单独提交一次。
- 使用清晰、简洁的提交信息。
- 提交前运行测试和 lint。
