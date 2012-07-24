#!/bin/bash
`dirname $0`/git_diff_cached.sh $1 $2 $3 | git apply --cached --reverse -