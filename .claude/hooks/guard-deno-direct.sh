#!/bin/bash
# Hook: block direct deno lint/fmt/test calls, enforce deno task check
# Receives tool input JSON on stdin

input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // empty')

if [ -z "$command" ]; then
  exit 0
fi

# Check for direct deno lint/fmt/test (but allow "deno task ...")
if echo "$command" | grep -qE '(^|\s|&&|\|\||;)deno\s+(lint|fmt|test)(\s|$)'; then
  if ! echo "$command" | grep -qE '(^|\s|&&|\|\||;)deno\s+task\s'; then
    echo "BLOCKED: Direct 'deno lint/fmt/test' is not allowed. Use 'deno task check' instead." >&2
    exit 2
  fi
fi

exit 0
