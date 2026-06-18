# Painel J

Dashboard interno (pt-BR) para gestão de **estoque, vendas e precificação** de produtos —
construído a partir da planilha de pesquisa `TabPesquisa`.

Protótipo para avaliação. Uso interno.

## Funcionalidades
- **Painel** — totais (receita, lucro, custo, imposto, capital) + margem média e fila de re-avaliação.
- **Produtos** — banco de dados com busca, filtros por saúde (🔴🟡🟢), link e edição.
- **Produto (add/editar)** — todos os campos + imagem + indicadores ao vivo.
- **Vendas avulsas** — registro de vendas fora do padrão.
- **Calculadora** — preço sugerido para a margem desejada, impacto do frete, capital, salvar cálculos.
- **Relatórios** — resumo + exportação em PDF.

Saúde por margem: 🔴 < 11% · 🟡 11–15% · 🟢 > 15%. Margem = lucro ÷ preço de venda.

## Stack
Vite + React + TypeScript + Tailwind + Framer Motion + Zustand. Dados locais (seed + localStorage).

## Rodar localmente
```bash
npm install
npm run dev      # http://localhost:5173
npm test         # testes do motor de cálculo
npm run build    # build de produção (dist/)
```

Deploy automático em GitHub Pages via `.github/workflows/deploy.yml` (a cada push na `main`).
