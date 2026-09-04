# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/79756d55-e8f3-4a96-a0d6-a9d3832a9ffd

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/79756d55-e8f3-4a96-a0d6-a9d3832a9ffd) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Deploy

Hospedado no **EasyPanel** (VPS Hostinger):
`https://conciliacao-pro-conciliacao-pro.kid1rw.easypanel.host/`

O deploy é **automático**: um webhook no GitHub chama a URL de deploy do
EasyPanel a cada push na `main`, que refaz o build do Dockerfile
(Node 20 Alpine -> Nginx Alpine) e republica o serviço.

- Acompanhar o build: EasyPanel -> projeto `conciliacao-pro` -> Implantações
- Publicar à mão (se o webhook falhar): botão **Implantar** no mesmo painel
- Entregas do webhook: GitHub -> Settings -> Webhooks -> Recent Deliveries

As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` são injetadas em
runtime pelo `docker-entrypoint.sh` (arquivo `public/env-config.js`), não no
build — trocar a chave não exige rebuild, só reiniciar o serviço.

> Observação: o projeto foi criado no Lovable, mas está **desvinculado** dele.
> Não usar o fluxo de publicação do Lovable.

