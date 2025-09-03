#!/bin/bash

# Script de instalação do rdcontext focado no Cursor
# Versão idempotente - evita duplicar variáveis no shell

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

    # Só adiciona se ainda não existir no arquivo
    if ! grep -q "$var_name" "$config_file" 2>/dev/null; then
        echo "$config_string" >> "$config_file"
        log_success "Adicionado $var_name em $config_file"
    else
        log_info "$var_name já existe em $config_file, pulando..."
    fi
}

# Verifica dependências
check_dependencies() {
    log_info "Verificando dependências..."

    if ! command -v node &>/dev/null; then
        log_error "❌ Node.js não encontrado!"
        exit 1
    fi
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
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
        log_success "Git $(git --version | cut -d' ' -f3) encontrado"
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

# Instala rdcontext
install_rdcontext() {
    log_info "Instalando rdcontext..."
    npm install -g git+https://github.com/resultadosdigitais/rdcontext.git
    if command -v rdcontext &>/dev/null; then
        log_success "rdcontext $(rdcontext --version) instalado com sucesso!"
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
        read -s -p "Digite sua Gemini API Key: " GEMINI_API_KEY
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
        read -s -p "Digite sua OpenAI API Key: " OPENAI_API_KEY
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
        read -s -p "Digite seu GitHub Token: " GITHUB_TOKEN
        echo
        if [ -n "$GITHUB_TOKEN" ]; then
            CONFIG_STRING="
# rdcontext GitHub configuration
export GITHUB_TOKEN=\"$GITHUB_TOKEN\""
            add_to_shell_config ~/.bashrc GITHUB_TOKEN "$CONFIG_STRING"
            [ -f ~/.zshrc ] && add_to_shell_config ~/.zshrc GITHUB_TOKEN "$CONFIG_STRING"
            export GITHUB_TOKEN="$GITHUB_TOKEN"
        fi
    fi
}

# Configura MCP no Cursor
configure_cursor_mcp() {
    local cursor_config_dir="$HOME/.cursor"
    local mcp_config="$cursor_config_dir/mcp.json"

    mkdir -p "$cursor_config_dir"
    cp "$mcp_config" "$mcp_config.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true

    cat >"$mcp_config" <<EOF
{
  "mcpServers": {
    "rdcontext": {
      "command": "rdcontext",
      "args": ["start"],
      "env": {
        "GEMINI_API_KEY": "$GEMINI_API_KEY",
        "OPENAI_API_KEY": "$OPENAI_API_KEY",
        "GITHUB_TOKEN": "$GITHUB_TOKEN",
        "AI_PROVIDER": "$AI_PROVIDER",
        "GEMINI_EMBEDDING_MODEL": "text-embedding-004",
        "OPENAI_EMBEDDING_MODEL": "text-embedding-3-large"
      }
    }
  }
}
EOF
    log_success "Configuração MCP criada em $mcp_config"
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

main() {
    print_header
    check_dependencies
    install_rdcontext
    configure_api_keys
    configure_github_token
    configure_cursor_mcp
    test_installation
    echo "🎉 Instalação concluída. Reinicie o Cursor para aplicar."
}

main "$@"
