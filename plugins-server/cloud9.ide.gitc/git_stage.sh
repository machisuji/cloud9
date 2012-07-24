#!/bin/bash
`dirname $0`/git_diff.sh $1 $2 $3 | git apply --cached -