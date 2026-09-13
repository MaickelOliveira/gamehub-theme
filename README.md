# Game Hub — tema Shopify

Este repositorio contem um tema Shopify e pode ser executado no EasyPanel por
meio do servidor de visualizacao da Shopify CLI.

## Configuracao no EasyPanel

Use o `Dockerfile` da raiz, publique a porta `3000` e adicione estas variaveis
em **Environment**:

```text
SHOPIFY_FLAG_STORE=sua-loja.myshopify.com
SHOPIFY_CLI_THEME_TOKEN=senha-gerada-pelo-theme-access
```

Se a vitrine estiver protegida por senha, adicione tambem:

```text
SHOPIFY_FLAG_STORE_PASSWORD=senha-da-vitrine
```

O token deve ser criado pelo aplicativo oficial **Theme Access** da Shopify e
deve existir apenas no ambiente do EasyPanel. Nunca coloque esse token no Git.

Depois de salvar as variaveis, execute um novo deploy. O container escuta em
`0.0.0.0:3000`.

> Este modo usa `shopify theme dev`, portanto funciona como uma visualizacao do
> tema ligada aos dados da loja Shopify. A publicacao oficial da loja continua
> sendo administrada pela Shopify.
