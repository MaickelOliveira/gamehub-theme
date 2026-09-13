#!/bin/sh
set -eu

if [ -z "${SHOPIFY_FLAG_STORE:-}" ]; then
  echo "Erro: defina SHOPIFY_FLAG_STORE no EasyPanel (exemplo: sua-loja.myshopify.com)." >&2
  exit 1
fi

if [ -z "${SHOPIFY_CLI_THEME_TOKEN:-}" ]; then
  echo "Erro: defina SHOPIFY_CLI_THEME_TOKEN no EasyPanel com a senha do app Theme Access." >&2
  exit 1
fi

exec "$@"
