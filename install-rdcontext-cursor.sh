#!/usr/bin/env bash

# Script de instalação do rdcontext focado no Cursor
# Versão idempotente - evita duplicar variáveis no shell

set -euo pipefail

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Inicializa variáveis para evitar erros com set -u
GEMINI_API_KEY=""
OPENAI_API_KEY=""
GITHUB_TOKEN=""
AI_PROVIDER="gemini" # valor padrão

# Funções de log
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

print_header() {
    echo
    echo " ____  ____   ____            _            _   "
    echo "|  _ \|  _ \ / ___|___  _ __ | |_ _____  _| |_ "
    echo "| |_) | | | | |   / _ \| '_ \| __/ _ \ \/ / __|"
    echo "|  _ <| |_| | |__| (_) | | | | ||  __/>  <|_ |"
    echo "|_| \_\____/ \____\___/|_| |_|\__\___/_/\_\\__|"
    echo "                                              "
    echo "🚀 Instalador rdcontext para Cursor"
    echo
}

# Adiciona variáveis de ambiente sem duplicar
add_to_shell_config() {
    local config_file=$1
    local var_name=$2
    local config_string=$3

    # Só adiciona se ainda não existir no arquivo (verifica declaração export real)
    if ! grep -qE "^[[:space:]]*export[[:space:]]+$var_name=" "$config_file" 2>/dev/null; then
        # Garante que não há caracteres especiais na string de configuração
        CLEAN_CONFIG=$(echo "$config_string" | tr -d '\r')
        echo "$CLEAN_CONFIG" >> "$config_file"
        log_success "Adicionado $var_name em $config_file"
    else
        log_info "$var_name já foi configurado em $config_file, pulando..."
    fi
}

# Verifica dependências
check_dependencies() {
    log_info "Verificando dependências..."

    if ! command -v node &>/dev/null; then
        log_error "❌ Node.js não encontrado!"
        exit 1
    fi
    NODE_VERSION=$(node --version | sed 's/^v//' | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "❌ Node.js $(node --version) é muito antigo!"
        exit 1
    else
        log_success "Node.js $(node --version) ✅"
    fi

    if ! command -v npm &>/dev/null; then
        log_error "❌ npm não encontrado!"
        exit 1
    else
        log_success "npm $(npm --version) encontrado"
    fi

    if ! command -v git &>/dev/null; then
        log_error "❌ Git não encontrado!"
        exit 1
    else
        log_success "Git $(git --version | awk '{print $3}') encontrado"
    fi

    if ! command -v jq &>/dev/null; then
        log_warning "⚠️  jq não encontrado. Instalando..."
        if command -v apt-get &>/dev/null; then
            sudo apt-get update && sudo apt-get install -y jq
        elif command -v yum &>/dev/null; then
            sudo yum install -y jq
        elif command -v brew &>/dev/null; then
            brew install jq
        else
            log_error "❌ Não foi possível instalar jq automaticamente"
            exit 1
        fi
        log_success "jq instalado com sucesso"
    else
        log_success "jq encontrado"
    fi
}

# Função para instalação global do npm com fallback para ~/.local
npm_global_install() {
    local PREFIX
    PREFIX="$(npm config get prefix 2>/dev/null || echo '')"
    if [ -n "$PREFIX" ] && [ -w "$PREFIX" ]; then
        npm install -g "$@"
    else
        if npm install -g "$@"; then :; else
            log_warning "Sem permissão no prefix do npm. Usando ~/.local"
            mkdir -p "$HOME/.local"
            npm install -g --prefix "$HOME/.local" "$@"
            # Adiciona ao PATH se não estiver presente
            ensure_path_contains "$HOME/.local/bin"
        fi
    fi
}

# Adiciona um diretório ao PATH se não estiver presente
ensure_path_contains() {
    local dir="$1"
    if [[ ":$PATH:" != *":$dir:"* ]]; then
        export PATH="$dir:$PATH"
        # Adiciona ao .bashrc e .zshrc se existirem
        for rcfile in ~/.bashrc ~/.zshrc; do
            if [ -f "$rcfile" ] && ! grep -q "export PATH=\"$dir:\$PATH\"" "$rcfile"; then
                echo "export PATH=\"$dir:\$PATH\"" >> "$rcfile"
                log_info "Adicionado $dir ao PATH em $rcfile"
            fi
        done
    fi
}

# Instala rdcontext
install_rdcontext() {
    log_info "Verificando se rdcontext já está instalado..."
    
    # Verifica se rdcontext já está funcionando
    if command -v rdcontext &>/dev/null; then
        log_success "rdcontext já está instalado e funcionando!"
        if rdcontext --version &>/dev/null; then
            log_success "Versão: $(rdcontext --version | tail -n1)"
            return 0
        else
            log_warning "rdcontext encontrado mas não está funcionando. Reinstalando..."
        fi
    fi
    
    log_info "Instalando rdcontext..."
    
    # Remove instalação anterior se existir
    if npm list -g rdcontext &>/dev/null; then
        log_info "Removendo instalação anterior..."
        npm uninstall -g rdcontext
    fi
    
    # Verifica se estamos dentro do repositório rdcontext
    if [ -f "./package.json" ] && grep -q "\"name\": \"rdcontext\"" "./package.json" 2>/dev/null; then
        log_info "Instalando a partir do repositório local..."
        npm install
        npm run build
        npm_global_install .
    else
        log_info "Instalando a partir do GitHub..."
        npm_global_install git+https://github.com/resultadosdigitais/rdcontext.git
    fi
    
    if command -v rdcontext &>/dev/null; then
        log_success "rdcontext $(rdcontext --version | tail -n1) instalado com sucesso!"
    else
        log_error "❌ Falha na instalação do rdcontext"
        exit 1
    fi
}

# Configura API Keys
configure_api_keys() {
    echo
    log_info "Configurando API Keys..."
    echo "1) Gemini (Google)"
    echo "2) OpenAI"
    echo "3) Pular"
    read -p "Escolha uma opção (1-3): " -n 1 -r
    echo

    case $REPLY in
    1)
        read -rs -p "Digite sua Gemini API Key: " GEMINI_API_KEY
        echo
        if [ -n "$GEMINI_API_KEY" ]; then
            CONFIG_STRING="
# rdcontext configuration
export GEMINI_API_KEY=\"$GEMINI_API_KEY\"
export AI_PROVIDER=\"gemini\"
export GEMINI_EMBEDDING_MODEL=\"text-embedding-004\""
            add_to_shell_config ~/.bashrc GEMINI_API_KEY "$CONFIG_STRING"
            [ -f ~/.zshrc ] && add_to_shell_config ~/.zshrc GEMINI_API_KEY "$CONFIG_STRING"
            export GEMINI_API_KEY="$GEMINI_API_KEY"
            export AI_PROVIDER="gemini"
        fi
        ;;
    2)
        read -rs -p "Digite sua OpenAI API Key: " OPENAI_API_KEY
        echo
        if [ -n "$OPENAI_API_KEY" ]; then
            CONFIG_STRING="
# rdcontext configuration
export OPENAI_API_KEY=\"$OPENAI_API_KEY\"
export AI_PROVIDER=\"openai\"
export OPENAI_EMBEDDING_MODEL=\"text-embedding-3-large\""
            add_to_shell_config ~/.bashrc OPENAI_API_KEY "$CONFIG_STRING"
            [ -f ~/.zshrc ] && add_to_shell_config ~/.zshrc OPENAI_API_KEY "$CONFIG_STRING"
            export OPENAI_API_KEY="$OPENAI_API_KEY"
            export AI_PROVIDER="openai"
        fi
        ;;
    *) log_info "Configuração de API Key pulada." ;;
    esac
}

# Configura GitHub Token
configure_github_token() {
    echo
    read -p "Deseja configurar GitHub Token agora? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -rs -p "Digite seu GitHub Token: " GITHUB_TOKEN
        echo
        if [ -n "$GITHUB_TOKEN" ]; then
            # Limpa o token de caracteres especiais
            CLEAN_TOKEN=$(echo "$GITHUB_TOKEN" | tr -d '\r\n' | xargs)
            CONFIG_STRING="
# rdcontext GitHub configuration
export GITHUB_TOKEN=\"$CLEAN_TOKEN\""
            add_to_shell_config ~/.bashrc GITHUB_TOKEN "$CONFIG_STRING"
            [ -f ~/.zshrc ] && add_to_shell_config ~/.zshrc GITHUB_TOKEN "$CONFIG_STRING"
            export GITHUB_TOKEN="$CLEAN_TOKEN"
            log_success "✅ GitHub Token configurado e limpo!"
        else
            log_warning "⚠️  Token vazio, GitHub Token não configurado"
        fi
    fi
}

# Configura MCP no Cursor
configure_cursor_mcp() {
    local cursor_config_dir="$HOME/.cursor"
    local mcp_config="$cursor_config_dir/mcp.json"

    mkdir -p "$cursor_config_dir"
    cp "$mcp_config" "$mcp_config.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true

    # Verifica se o arquivo mcp.json já existe
    if [ -f "$mcp_config" ]; then
        log_info "Atualizando configuração MCP existente..."
        
        # Atualiza o arquivo existente, preservando outras configurações
        # Cria objeto de ambiente apenas com chaves que têm valores
        local env_obj="{}"
        if [ -n "$GEMINI_API_KEY" ]; then
            env_obj=$(echo "$env_obj" | jq --arg key "$GEMINI_API_KEY" '. + {"GEMINI_API_KEY": $key}')
        fi
        if [ -n "$OPENAI_API_KEY" ]; then
            env_obj=$(echo "$env_obj" | jq --arg key "$OPENAI_API_KEY" '. + {"OPENAI_API_KEY": $key}')
        fi
        if [ -n "$GITHUB_TOKEN" ]; then
            env_obj=$(echo "$env_obj" | jq --arg key "$GITHUB_TOKEN" '. + {"GITHUB_TOKEN": $key}')
        fi
        if [ -n "$AI_PROVIDER" ]; then
            env_obj=$(echo "$env_obj" | jq --arg provider "$AI_PROVIDER" '. + {"AI_PROVIDER": $provider}')
        fi
        
        # Sempre adiciona os modelos de embedding
        env_obj=$(echo "$env_obj" | jq '. + {"GEMINI_EMBEDDING_MODEL": "text-embedding-004"}')
        env_obj=$(echo "$env_obj" | jq '. + {"OPENAI_EMBEDDING_MODEL": "text-embedding-3-large"}')
        
        jq --argjson env "$env_obj" \
           '.mcpServers.rdcontext |= ((. // { "env": {} }) + { "command": "rdcontext", "args": ["start"] } | .env += $env)' \
            "$mcp_config" > "$mcp_config.tmp" && mv "$mcp_config.tmp" "$mcp_config"
        log_success "Configuração MCP atualizada em $mcp_config"
    else
        # Cria um novo arquivo se não existir
        log_info "Criando nova configuração MCP..."
        
        # Cria objeto de ambiente apenas com chaves que têm valores
        local env_obj="{}"
        if [ -n "$GEMINI_API_KEY" ]; then
            env_obj=$(echo "$env_obj" | jq --arg key "$GEMINI_API_KEY" '. + {"GEMINI_API_KEY": $key}')
        fi
        if [ -n "$OPENAI_API_KEY" ]; then
            env_obj=$(echo "$env_obj" | jq --arg key "$OPENAI_API_KEY" '. + {"OPENAI_API_KEY": $key}')
        fi
        if [ -n "$GITHUB_TOKEN" ]; then
            env_obj=$(echo "$env_obj" | jq --arg key "$GITHUB_TOKEN" '. + {"GITHUB_TOKEN": $key}')
        fi
        if [ -n "$AI_PROVIDER" ]; then
            env_obj=$(echo "$env_obj" | jq --arg provider "$AI_PROVIDER" '. + {"AI_PROVIDER": $provider}')
        fi
        
        # Sempre adiciona os modelos de embedding
        env_obj=$(echo "$env_obj" | jq '. + {"GEMINI_EMBEDDING_MODEL": "text-embedding-004"}')
        env_obj=$(echo "$env_obj" | jq '. + {"OPENAI_EMBEDDING_MODEL": "text-embedding-3-large"}')
        
        jq -n --argjson env "$env_obj" \
            '{
                "mcpServers": {
                    "rdcontext": {
                        "command": "rdcontext",
                        "args": ["start"],
                        "env": $env
                    }
                }
            }' > "$mcp_config"
        log_success "Configuração MCP criada em $mcp_config"
    fi
}

# Adiciona bibliotecas de exemplo
add_example_libraries() {
    echo
    read -r -p "Deseja adicionar as bibliotecas da RD Station (Tangram e FrontHub)? (y/n): " add_examples
    
    if [[ $add_examples =~ ^[Yy]$ ]]; then
        if [ -z "$GITHUB_TOKEN" ]; then
            log_error "❌ GitHub Token necessário para adicionar bibliotecas da RD Station"
            echo "Configure o token primeiro com: export GITHUB_TOKEN=\"seu_token\""
            return
        fi
        
        # Valida e limpa o token
        CLEAN_TOKEN=$(echo "$GITHUB_TOKEN" | tr -d '\r\n' | xargs)
        if [ -z "$CLEAN_TOKEN" ]; then
            log_error "❌ GitHub Token está vazio após limpeza"
            return
        fi
        
        log_info "🔑 Token GitHub validado e limpo"
        
        # Verifica se tem API Key configurada
        if [ -z "$GEMINI_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
            log_error "❌ API Key necessária para processar documentação!"
            echo "Configure uma API Key primeiro (Gemini ou OpenAI)"
            return
        fi
        
        log_info "Adicionando FrontHub..."
        log_info "Comando: rdcontext add \"resultadosdigitais/front-hub\" --folders \"packages/front-hub-docs/docs\" --token [GITHUB_TOKEN]"
        echo
        # Limpa o token de caracteres especiais e espaços
        CLEAN_TOKEN=$(echo "$GITHUB_TOKEN" | tr -d '\r\n' | xargs)
        rdcontext add "resultadosdigitais/front-hub" --folders "packages/front-hub-docs/docs" --token "$CLEAN_TOKEN"
        log_success "FrontHub adicionado com sucesso!"
        
        log_info "Adicionando Tangram Design System..."
        log_info "Comando: rdcontext add \"resultadosdigitais/tangram\" --folders \"docs/examples/components\" \"docs/docs\" \"docs/code\" --token [GITHUB_TOKEN]"
        echo
        rdcontext add "resultadosdigitais/tangram" --folders "docs/examples/components" "docs/docs" "docs/code" --token "$CLEAN_TOKEN"
        log_success "Tangram adicionado com sucesso!"
    fi
}

# Testa a instalação
test_installation() {
    if rdcontext --version &>/dev/null; then
        log_success "✅ rdcontext está funcionando!"
    else
        log_error "❌ Erro ao executar rdcontext"
        exit 1
    fi
    rdcontext list
}

# Mostra próximos passos
show_next_steps() {
    echo
    echo "🎉 Instalação concluída com sucesso!"
    echo
    echo "📋 Próximos passos:"
    echo
    echo "1. Reinicie o Cursor para aplicar as configurações MCP"
    echo
    echo "2. No Cursor, teste digitando:"
    echo "   'Mostre exemplos de botões do Tangram'"
    echo
    echo "3. Para adicionar mais bibliotecas:"
    echo "   rdcontext add \"owner/repo\" --folders \"pasta1\" \"pasta2\" --token SEU_GITHUB_TOKEN"
    echo
    echo "4. Comandos úteis:"
    echo "   rdcontext list                    # Lista bibliotecas"
    echo "   rdcontext get \"repo\" \"query\"     # Busca contexto"
    echo
    echo "5. Comandos específicos para RD Station:"
    echo "   rdcontext add \"resultadosdigitais/front-hub\" --folders \"packages/front-hub-docs/docs\" --token SEU_GITHUB_TOKEN"
    echo
    echo "   rdcontext add \"resultadosdigitais/tangram\" --folders \"docs/examples/components\" \"docs/docs\" \"docs/code\" --token SEU_GITHUB_TOKEN"
    echo
    echo
    echo "📚 Documentação completa:"
    echo "   https://github.com/resultadosdigitais/rdcontext"
    echo "   README.md - Guia completo de instalação e uso"
    echo
}

main() {
    print_header
    check_dependencies
    install_rdcontext
    configure_api_keys
    configure_github_token
    configure_cursor_mcp
    add_example_libraries
    test_installation
    show_next_steps
}

main "$@"
