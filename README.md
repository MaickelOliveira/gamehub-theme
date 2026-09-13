# Game Hub

E-commerce independente preparado para rodar no EasyPanel, sem depender da
Shopify. Inclui catalogo, estoque, carrinho, checkout com Pix, pedidos e painel
administrativo.

## EasyPanel

1. Use o `Dockerfile` da raiz.
2. Publique a porta `3000`.
3. Monte um volume persistente em `/data`.
4. Defina pelo menos `ADMIN_PASSWORD` e `SESSION_SECRET` em **Environment**.
5. Execute um novo deploy.

O banco SQLite e criado automaticamente em `/data/gamehub.db`. A loja abre sem
variaveis obrigatorias; sem `ADMIN_PASSWORD`, apenas o painel administrativo
fica bloqueado.

As antigas variaveis `SHOPIFY_FLAG_STORE` e `SHOPIFY_CLI_THEME_TOKEN` nao sao
mais usadas e podem ser removidas do EasyPanel.

## Variaveis de ambiente

```text
ADMIN_PASSWORD=uma-senha-forte
SESSION_SECRET=uma-chave-aleatoria-longa
PORT=3000
DATA_DIR=/data
```

As configuracoes comerciais, como chave Pix, WhatsApp, desconto e e-mail, sao
alteradas no painel `/admin` e ficam salvas no banco.

O checkout cria o pedido, reserva o estoque e mostra a chave Pix configurada. A
confirmacao do pagamento e feita no painel administrativo.

## Desenvolvimento local

```bash
npm install
npm run dev
```

O tema Liquid antigo permanece no repositorio apenas como referencia visual.
