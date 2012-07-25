#!/bin/bash
echo "$2" | git diff --no-index -U0 -- $1 -