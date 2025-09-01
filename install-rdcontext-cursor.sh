#!/bin/bash

# Script de instalação do rdcontext focado no Cursor
# Versão limpa - sem verificação de variáveis existentes

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções de log
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

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

# Verifica dependências
check_dependencies() {
    log_info "Verificando dependências..."
    
    # Node.js
    if ! command -v node &> /dev/null; then
        log_error "❌ Node.js não encontrado!"
        echo "Instale Node.js 18+ de: https://nodejs.org/"
        exit 1
    else
        NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -lt 18 ]; then
            log_error "❌ Node.js $(node --version) é muito antiga!"
            echo "rdcontext requer Node.js 18+ para ES modules e top-level await"
            exit 1
        else
            log_success "Node.js $(node --version) ✅"
        fi
    fi
    
    # npm
    if ! command -v npm &> /dev/null; then
        log_error "❌ npm não encontrado!"
        exit 1
    else
        log_success "npm $(npm --version) encontrado"
    fi
    
    # Git
    if ! command -v git &> /dev/null; then
        log_error "❌ Git não encontrado!"
        exit 1
    else
        log_success "Git $(git --version | cut -d' ' -f3) encontrado"
    fi
    
    # jq (para merge do mcp.json)
    if ! command -v jq &> /dev/null; then
        log_warning "⚠️  jq não encontrado. Instalando..."
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y jq
        elif command -v yum &> /dev/null; then
            sudo yum install -y jq
        elif command -v brew &> /dev/null; then
            brew install jq
        else
            log_error "❌ Não foi possível instalar jq automaticamente"
            echo "Instale jq manualmente: https://jqlang.github.io/jq/"
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
    
    if [ -f "package.json" ] && grep -q '"name": "rdcontext"' package.json; then
        log_info "Detectado repositório local do rdcontext"
        log_info "Instalando dependências..."
        npm install
        
        log_info "Fazendo build..."
        npm run build
        
        log_info "Instalando globalmente..."
        npm install -g .
    else
        log_info "Instalando do GitHub..."
        npm install -g git+https://github.com/resultadosdigitais/rdcontext.git
    fi
    
    # Verifica instalação
    if command -v rdcontext &> /dev/null; then
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
    
    # Sempre pergunta qual provedor usar
    echo "Qual provedor de IA você deseja usar?"
    echo "1) Gemini (Google) - Recomendado"
    echo "2) OpenAI"
    echo "3) Pular (configurar depois)"
    read -p "Escolha uma opção (1-3): " -n 1 -r
    echo
    
    case $REPLY in
        1)
            echo
            log_info "🔑 Configurando Gemini API Key..."
            read -s -p "Digite sua API Key do Gemini (não será exibida): " GEMINI_API_KEY
            echo
            if [ -n "$GEMINI_API_KEY" ]; then
                echo "export GEMINI_API_KEY=\"$GEMINI_API_KEY\"" >> ~/.bashrc
                echo "export AI_PROVIDER=\"gemini\"" >> ~/.bashrc
                export GEMINI_API_KEY="$GEMINI_API_KEY"
                export AI_PROVIDER="gemini"
                log_success "✅ API Key do Gemini configurada!"
            else
                log_warning "⚠️  API Key vazia, Gemini não configurado"
            fi
            ;;
        2)
            echo
            log_info "🔑 Configurando OpenAI API Key..."
            read -s -p "Digite sua API Key da OpenAI (não será exibida): " OPENAI_API_KEY
            echo
            if [ -n "$OPENAI_API_KEY" ]; then
                echo "export OPENAI_API_KEY=\"$OPENAI_API_KEY\"" >> ~/.bashrc
                echo "export AI_PROVIDER=\"openai\"" >> ~/.bashrc
                export OPENAI_API_KEY="$OPENAI_API_KEY"
                export AI_PROVIDER="openai"
                log_success "✅ API Key da OpenAI configurada!"
            else
                log_warning "⚠️  API Key vazia, OpenAI não configurado"
            fi
            ;;
        3)
            log_info "Configuração de API Key pulada."
            ;;
    esac
}

# Configura GitHub Token
configure_github_token() {
    echo
    log_info "Configurando GitHub Token..."
    
    echo "Para acessar repositórios privados da RD Station, você precisa de um GitHub Token."
    echo
    read -p "Deseja configurar o GitHub Token agora? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo
        read -s -p "Digite seu GitHub Token (não será exibido): " GITHUB_TOKEN
        echo
        if [ -n "$GITHUB_TOKEN" ]; then
            echo "export GITHUB_TOKEN=\"$GITHUB_TOKEN\"" >> ~/.bashrc
            export GITHUB_TOKEN="$GITHUB_TOKEN"
            log_success "✅ GitHub Token configurado!"
        else
            log_warning "⚠️  Token vazio, GitHub Token não configurado"
        fi
    else
        log_info "GitHub Token não configurado. Configure depois com:"
        echo "export GITHUB_TOKEN=\"seu_token_aqui\""
    fi
}

# Configura MCP no Cursor
configure_cursor_mcp() {
    local cursor_config_dir="$HOME/.cursor"
    local mcp_config="$cursor_config_dir/mcp.json"
    
    mkdir -p "$cursor_config_dir"
    
    # Backup do arquivo existente se houver
    if [ -f "$mcp_config" ]; then
        log_warning "Arquivo mcp.json já existe. Fazendo backup..."
        cp "$mcp_config" "$mcp_config.backup.$(date +%Y%m%d_%H%M%S)"
    fi

    # Cria configuração temporária do rdcontext
    local temp_rdcontext_config=$(mktemp)
    
    # Constrói o JSON de forma mais robusta
    cat > "$temp_rdcontext_config" << EOF
{
  "mcpServers": {
    "rdcontext": {
      "command": "rdcontext",
      "args": ["start"],
      "env": {
EOF

    # Adiciona variáveis de ambiente se configuradas
    local env_vars=()
    if [ -n "$GEMINI_API_KEY" ]; then
        env_vars+=("        \"GEMINI_API_KEY\": \"$GEMINI_API_KEY\"")
        env_vars+=("        \"AI_PROVIDER\": \"gemini\"")
        env_vars+=("        \"GEMINI_EMBEDDING_MODEL\": \"text-embedding-004\"")
    fi
    
    if [ -n "$OPENAI_API_KEY" ]; then
        env_vars+=("        \"OPENAI_API_KEY\": \"$OPENAI_API_KEY\"")
        env_vars+=("        \"AI_PROVIDER\": \"openai\"")
        env_vars+=("        \"OPENAI_EMBEDDING_MODEL\": \"text-embedding-3-large\"")
    fi
    
    if [ -n "$GITHUB_TOKEN" ]; then
        env_vars+=("        \"GITHUB_TOKEN\": \"$GITHUB_TOKEN\"")
    fi

    # Adiciona as variáveis de ambiente ao JSON
    if [ ${#env_vars[@]} -gt 0 ]; then
        local last_index=$((${#env_vars[@]} - 1))
        for i in "${!env_vars[@]}"; do
            if [ $i -eq $last_index ]; then
                # Última variável - sem vírgula
                echo "${env_vars[$i]}" >> "$temp_rdcontext_config"
            else
                # Outras variáveis - com vírgula
                echo "${env_vars[$i]}," >> "$temp_rdcontext_config"
            fi
        done
    fi
    
    # Fecha o JSON
    cat >> "$temp_rdcontext_config" << EOF
      }
    }
  }
}
EOF

    if [ -f "$mcp_config" ]; then
        log_info "Fazendo merge com configurações MCP existentes..."
        
        # Valida o JSON existente antes do merge
        if ! jq empty "$mcp_config" 2>/dev/null; then
            log_error "❌ Arquivo mcp.json existente tem JSON inválido!"
            log_info "Restaurando do backup..."
            cp "$mcp_config.backup.$(date +%Y%m%d_%H%M%S)" "$mcp_config" 2>/dev/null || {
                log_error "❌ Falha ao restaurar backup. Criando novo arquivo..."
                rm -f "$mcp_config"
            }
        fi
        
        # Valida o JSON do rdcontext antes do merge
        if ! jq empty "$temp_rdcontext_config" 2>/dev/null; then
            log_error "❌ JSON do rdcontext é inválido!"
            rm -f "$temp_rdcontext_config"
            return 1
        fi
        
        # Faz o merge de forma mais segura
        local merge_result=$(mktemp)
        if jq -s '.[0] * .[1]' "$mcp_config" "$temp_rdcontext_config" > "$merge_result" 2>/dev/null; then
            # Valida o resultado do merge
            if jq empty "$merge_result" 2>/dev/null; then
                mv "$merge_result" "$mcp_config"
                log_success "Configuração MCP atualizada preservando outras configurações"
            else
                log_error "❌ Resultado do merge é JSON inválido!"
                log_info "Restaurando configuração original..."
                cp "$mcp_config.backup.$(date +%Y%m%d_%H%M%S)" "$mcp_config" 2>/dev/null
                rm -f "$merge_result"
            fi
        else
            log_error "❌ Falha no merge do JSON!"
            log_info "Restaurando configuração original..."
            cp "$mcp_config.backup.$(date +%Y%m%d_%H%M%S)" "$mcp_config" 2>/dev/null
            rm -f "$merge_result"
        fi
        
        rm -f "$temp_rdcontext_config"
    else
        # Cria novo arquivo
        mv "$temp_rdcontext_config" "$mcp_config"
        log_success "Nova configuração MCP criada"
    fi
    
    log_success "Configuração MCP criada em $mcp_config"
    echo
    log_info "⚠️  IMPORTANTE: Reinicie o Cursor para aplicar as configurações MCP!"
}

# Adiciona bibliotecas de exemplo
add_example_libraries() {
    echo
    read -p "Deseja adicionar as bibliotecas da RD Station (Tangram e FrontHub)? (y/n): " add_examples
    
    if [[ $add_examples =~ ^[Yy]$ ]]; then
        if [ -z "$GITHUB_TOKEN" ]; then
            log_error "❌ GitHub Token necessário para adicionar bibliotecas da RD Station"
            echo "Configure o token primeiro com: export GITHUB_TOKEN=\"seu_token\""
            return
        fi
        
        # Verifica se tem API Key configurada
        if [ -z "$GEMINI_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
            log_error "❌ API Key necessária para processar documentação!"
            echo "Configure uma API Key primeiro (Gemini ou OpenAI)"
            return
        fi
        
        log_info "Adicionando FrontHub..."
        log_info "Comando: rdcontext add \"resultadosdigitais/front-hub\" --folders \"packages/front-hub-docs/docs\" --token [GITHUB_TOKEN]"
        echo
        rdcontext add "resultadosdigitais/front-hub" --folders "packages/front-hub-docs/docs" --token "$GITHUB_TOKEN"
        log_success "FrontHub adicionado com sucesso!"
        
        log_info "Adicionando Tangram Design System..."
        log_info "Comando: rdcontext add \"resultadosdigitais/tangram\" --folders \"docs/examples/componests\" \"docs/docs\" \"docs/code\" --token [GITHUB_TOKEN]"
        echo
        rdcontext add "resultadosdigitais/tangram" --folders "docs/examples/componests" "docs/docs" "docs/code" --token "$GITHUB_TOKEN"
        log_success "Tangram adicionado com sucesso!"
    fi
}

# Testa a instalação
test_installation() {
    log_info "Testando instalação..."
    
    if rdcontext --version &> /dev/null; then
        log_success "✅ rdcontext está funcionando!"
    else
        log_error "❌ Erro ao executar rdcontext"
        exit 1
    fi
    
    # Lista bibliotecas
    echo
    log_info "Bibliotecas indexadas:"
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
    echo "   rdcontext add \"resultadosdigitais/tangram\" --folders \"docs/examples/componests\" \"docs/docs\" \"docs/code\" --token SEU_GITHUB_TOKEN"
    echo
    echo
    echo "📚 Documentação completa:"
    echo "   https://github.com/resultadosdigitais/rdcontext"
    echo "   README.md - Guia completo de instalação e uso"
    echo
}

# Função principal
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

# Executa o script
main "$@"
