# RDContext

**Servidor Local, Privado e Otimizado para IA de Documentação de Código**

RDContext é uma ferramenta local e focada em privacidade para construir contexto amigável à IA para qualquer biblioteca baseada em seus arquivos de documentação — incluindo repositórios privados. Extraia, indexe e sirva documentação para assistentes de IA, IDEs e fluxos de trabalho com LLM.

---

## Início Rápido

### 🚀 Instalação Automatizada (Recomendada)

```bash
# Clone o repositório
git clone https://github.com/resultadosdigitais/rdcontext.git
cd rdcontext

# Dar permissão de execução ao script
chmod +x install-rdcontext-cursor.sh

# Execute o script de instalação
./install-rdcontext-cursor.sh
```

Este script irá:
- ✅ Verificar versão do Node.js (18.12+ obrigatório, 20+ LTS recomendado)
- ✅ Instalar rdcontext globalmente
- ✅ Configurar API keys (Gemini/OpenAI) de forma segura
- ✅ Configurar token do GitHub para repos privados
- ✅ Configurar MCP para o Cursor automaticamente
- ✅ Adicionar bibliotecas de exemplo (FrontHub, Tangram)

### 📋 Instalação Manual

**Requisitos:**
- Node.js 18.12+ (20+ LTS recomendado)
- npm ou bun
- Git

```bash
# Instalar globalmente
npm install -g rdcontext

# Ou usar diretamente
npx rdcontext --help
```

---

## Visão Geral

O RDContext MCP busca documentação e exemplos de código atualizados e específicos de versão de repositórios GitHub e os disponibiliza para sua IDE.

Adicione `use rdcontext` ao seu prompt no Cursor:

```
Crie um componente Button usando o Tangram Design System, use rdcontext
```

O RDContext busca exemplos de código e documentação atualizados diretamente no contexto do seu LLM.

1. Escreva seu prompt
2. Diga ao LLM para usar RDContext
3. Obtenha respostas de código funcionais

Sem mudança de abas, sem APIs alucinadas, sem gerações de código desatualizadas.

## Como funciona

1. **Adicionar uma Biblioteca:**  
   Use a CLI para buscar arquivos de documentação (Markdown/MDX) de repo/branch/tag/pastas especificadas.

2. **Extração por IA:**  
   Cada arquivo de documentação é processado por LLM para extrair snippets de código, títulos e descrições otimizadas para recuperação.

3. **Indexação Local:**  
   Todos os dados extraídos são armazenados em um banco de dados SQLite local no diretório de dados do usuário.

4. **Consulta e Servir:**  
   Use a CLI para consultar docs/snippets, ou inicie o servidor MCP para integrar com ferramentas de IA.

## Funcionalidades

- **CLI:** Adicione, liste e remova documentação usando nossa CLI
- **Servidor MCP:** Servidor Model Context Protocol para o Cursor
- **Local e Privado:** Todos os dados armazenados localmente usando SQLite. Sem nuvem necessária
- **Personalizável:** Escolha pastas/arquivos para indexar, controle branches/tags
- **Repos Privados:** Adicione documentação de repositórios GitHub privados
- **Multiplataforma:** Funciona no Linux, macOS e Windows

---

## Configuração do Ambiente

### API Keys

**Obrigatório:** Configure pelo menos uma API key de provedor de IA:

#### Instalação Interativa (Recomendado)

O script de instalação sempre pergunta ao usuário pelas configurações necessárias:

- **API Keys** são solicitadas interativamente
- **GitHub Token** é configurado conforme escolha do usuário
- **Provedor de IA** é selecionado pelo usuário
- **Configurações MCP** são criadas automaticamente

#### Configuração Manual

```bash
# Para Gemini (recomendado)
export GEMINI_API_KEY="sua-chave-aqui"
export AI_PROVIDER="gemini"

# Para OpenAI (alternativo)
export OPENAI_API_KEY="sua-chave-aqui"
export AI_PROVIDER="openai"
```

**Configuração via arquivo .env:**
```bash
# ~/.env ou ~/.bashrc ou ~/.zshrc
export GEMINI_API_KEY="sua-api-key-do-gemini"
export OPENAI_API_KEY="sua-api-key-do-openai"  # opcional
export AI_PROVIDER="gemini"  # ou "openai"
```

Obtenha suas chaves:
- **Gemini:** https://makersuite.google.com/app/apikey
- **OpenAI:** https://platform.openai.com/api-keys

### Token do GitHub (Opcional)

Para repositórios privados:

```bash
export GITHUB_TOKEN=ghp_seu_token_github_aqui
```

Obtenha seu token: https://github.com/settings/tokens

---

## Uso

### Comandos da CLI

#### Adicionar uma Biblioteca

```bash
rdcontext add <owner/repo> [--branch <branch>] [--tag <tag>] [--folders <pasta1> <pasta2>] [--token <github_token>]
```

**Exemplos:**

```bash
# Adicionar o Tangram (design system)
rdcontext add "resultadosdigitais/tangram" --folders "docs/examples/components" "docs/docs" "docs/code" --token ghp_xxx

# Adicionar o FrontHub (microfrontends)
rdcontext add "resultadosdigitais/front-hub" --folders "packages/front-hub-docs/docs" --token ghp_xxx

# Adicionar versão específica
rdcontext add "shadcn-ui/ui" --tag v0.9.4

# Repo privado com token
rdcontext add "myorg/myrepo" --folders "docs" --token ghp_xxx
```

#### Listar Bibliotecas

```bash
rdcontext list
```

#### Consultar Documentação

```bash
rdcontext get <owner/repo> [tópico] [--k <número_de_snippets>]
```

**Exemplos:**
```bash
# Buscar exemplos de botões
rdcontext get resultadosdigitais/tangram "botão"

# Buscar exemplos de componentes
rdcontext get resultadosdigitais/front-hub "componente"

# Buscar padrões de design
rdcontext get resultadosdigitais/tangram "padrões de design"
```

#### Remover Biblioteca

```bash
rdcontext rm <owner/repo>
```



---

## Integração com o Cursor

### 🚀 Configuração Automática (Recomendada)

Use o script de instalação que configura automaticamente o MCP:

```bash
./install-rdcontext-cursor.sh
```

### ⚙️ Configuração Manual

Se preferir configurar manualmente, adicione ao `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "rdcontext": {
      "command": "rdcontext",
      "args": ["start"],
      "env": {
        "AI_PROVIDER": "gemini",
        "GEMINI_API_KEY": "sua-api-key-aqui",
        "GEMINI_EMBEDDING_MODEL": "text-embedding-004"
      }
    }
  }
}
```

### 🔧 Como usar no Cursor

1. **Instale o rdcontext** usando o script de instalação
2. **Reinicie o Cursor** para aplicar as configurações MCP
3. **Digite no editor**: `"Mostre exemplos de botões do Tangram"`
4. **Use o contexto**: O rdcontext fornecerá exemplos reais e atualizados

---

## Requisitos de Versão do Node.js

**Mínimo:** Node.js 18.12+  
**Recomendado:** Node.js 20+ LTS

O RDContext usa recursos modernos do JavaScript:
- ES Modules (`import`/`export`)
- `await` de nível superior
- API Fetch nativa
- APIs crypto modernas

### Solução de Problemas do Node.js

**Verificar versão:**
```bash
node --version
```

**Atualizar Node.js:**
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS
brew install node

# Ou use nvm
nvm install --lts
nvm use --lts
```

**Erros comuns:**
- `SyntaxError: Unexpected token 'export'` → Atualize o Node.js
- `ReferenceError: fetch is not defined` → Atualize para Node.js 18+
- `Cannot use import statement` → Atualize o Node.js

---

## Armazenamento de Dados

- **Banco de Dados:** Usa diretório padrão de dados do SO
  - Linux: `~/.local/share/rdcontext/rdcontext.db`
  - macOS: `~/Library/Application Support/rdcontext/rdcontext.db`
  - Windows: `%LOCALAPPDATA%\rdcontext\Data\rdcontext.db`

- **Sem Nuvem:** Todos os dados permanecem na sua máquina
- **Privacidade:** Sem telemetria ou compartilhamento de dados externos

---



## 🎯 Casos de Uso e Comandos

### 🛠️ Comandos Principais

```bash
# Listar bibliotecas
rdcontext list

# Adicionar nova biblioteca
rdcontext add <owner/repo> --folders docs,src

# Remover biblioteca
rdcontext rm <owner/repo>

# Buscar documentação
rdcontext get <owner/repo> "tema"

# Iniciar servidor MCP
rdcontext start
```

### 🚀 Exemplos Práticos

**Para Desenvolvedores:**
```bash
rdcontext get "resultadosdigitais/tangram" "padrões de design"
rdcontext get "resultadosdigitais/tangram" "formulário validação" 
rdcontext get "resultadosdigitais/tangram" "ícones"
```

**Para Criação de Telas:**
```bash
rdcontext get "resultadosdigitais/front-hub" "layout responsivo"
rdcontext get "resultadosdigitais/front-hub" "microfrontend"
rdcontext get "resultadosdigitais/front-hub" "integração"
```

### 🎯 Teste no Cursor

Digite no editor:
```
👉 "Mostre exemplos de formulários do Tangram"
```

---

## Solução de Problemas

### Problemas Comuns

**"rdcontext: command not found"**
```bash
# Recarregar shell
source ~/.bashrc  # ou ~/.zshrc

# Ou instalar globalmente
npm install -g rdcontext
```

**Erro de API Key**
```bash
echo $GEMINI_API_KEY
export GEMINI_API_KEY="sua-chave"
```

**Erro de permissão**
```bash
chmod +x $(which rdcontext)
```

**Servidor não responde**
```bash
ps aux | grep rdcontext
pkill -f rdcontext
rdcontext start
```

**"No sessionId" no navegador**
- Isso é normal para servidores MCP
- Use através da sua IDE, não diretamente no navegador

**Limites de Rate da API**
- Use token do GitHub para limites maiores
- Gemini tem tier gratuito generoso
- OpenAI requer conta paga para uso em produção

**Erros de Build**
```bash
# Limpar cache e reinstalar
npm cache clean --force
npm install -g rdcontext
```

### Obtendo Ajuda

1. Verifique este README
2. Execute `rdcontext --help`
3. Verifique Issues no GitHub
4. Verifique versão do Node.js (18.12+ obrigatório)

---

## 📚 Scripts de Instalação

### `install-rdcontext-cursor.sh`
Script principal para instalação no Cursor:
- ✅ Instalação limpa e interativa
- ✅ Configuração automática do MCP
- ✅ Preserva configurações MCP existentes
- ✅ Adiciona bibliotecas da RD Station automaticamente

```bash
# Dar permissão de execução
chmod +x install-rdcontext-cursor.sh

# Executar instalação
./install-rdcontext-cursor.sh
```

---

## 🛠️ Desenvolvimento

```bash
# Clonar repositório
git clone https://github.com/resultadosdigitais/rdcontext.git
cd rdcontext

# Instalar dependências
npm install

# Build
npm run build

# Instalar localmente
npm install -g .

# Executar testes
npm test
```

---

## Licença

Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

**✨ Feliz codificação com RDContext!**