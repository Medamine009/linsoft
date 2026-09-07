#!/bin/sh
# Compile le rapport en trois passes (references, table des matieres, minitoc).
set -e
for i in 1 2 3; do
  pdflatex -interaction=nonstopmode main.tex > "pass$i.log" 2>&1 || true
done
echo "=== resultat ==="
grep -E "Output written" "pass3.log" || echo "PDF NON PRODUIT"
echo "=== erreurs ==="
grep -E "^! " "pass3.log" || echo "aucune"
echo "=== references non resolues / labels dupliques ==="
grep -iE "undefined|multiply.defined" "pass3.log" | sort -u || echo "aucune"
