#!/bin/bash
# git_diff_cached <file> <start_line> <num_lines>
#
# Prints the diff for the given file's chunk which starts at <start_line> and is <num_lines> long.
#
# Note: This breaks if git's autocrlf is true because of the emitted warnings.

((git diff --cached $1 | head -n4) && (git diff --cached $1 | tail -n+$(expr 5 + $2) | head -n$3))
