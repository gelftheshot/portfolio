#!/bin/bash

# Create directories
mkdir -p about contact portfolio testaanimation

# Create page.jsx files in each directory
for dir in about contact portfolio testaanimation; do
    touch "$dir/page.jsx"
done

echo "Folders and page.jsx files created successfully."
