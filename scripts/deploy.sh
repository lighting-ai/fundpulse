#!/bin/bash

# FundPulse 快速部署脚本
# 使用方法: ./scripts/deploy.sh [选项]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 未安装，请先安装 $1"
        exit 1
    fi
}

# 显示帮助信息
show_help() {
    echo "FundPulse 部署脚本"
    echo ""
    echo "用法: ./scripts/deploy.sh [选项]"
    echo ""
    echo "选项:"
    echo "  build         构建项目"
    echo "  docker        构建 Docker 镜像"
    echo "  docker-run    运行 Docker 容器"
    echo "  docker-stop   停止 Docker 容器"
    echo "  gh-pages      部署到 GitHub Pages"
    echo "  help          显示此帮助信息"
    echo ""
}

# 构建项目
build_project() {
    print_info "开始构建项目..."
    npm ci
    npm run build
    print_info "构建完成！构建产物在 dist 目录"
}

# Docker 相关操作
docker_build() {
    print_info "构建 Docker 镜像..."
    docker build -t fundpulse:latest .
    print_info "Docker 镜像构建完成！"
}

docker_run() {
    print_info "启动 Docker 容器..."
    docker run -d \
        --name fundpulse \
        -p 8080:80 \
        --restart unless-stopped \
        fundpulse:latest
    print_info "容器已启动！访问 http://localhost:8080"
}

docker_stop() {
    print_info "停止 Docker 容器..."
    docker stop fundpulse 2>/dev/null || true
    docker rm fundpulse 2>/dev/null || true
    print_info "容器已停止！"
}

# 部署到 GitHub Pages
deploy_gh_pages() {
    check_command gh-pages
    
    print_info "部署到 GitHub Pages..."
    npm run build
    
    # 检查是否存在 gh-pages
    if ! command -v gh-pages &> /dev/null; then
        print_warn "gh-pages 未安装，正在安装..."
        npm install -g gh-pages
    fi
    
    gh-pages -d dist
    print_info "部署完成！"
}

# 主逻辑
main() {
    case "${1:-help}" in
        build)
            build_project
            ;;
        docker)
            check_command docker
            docker_build
            ;;
        docker-run)
            check_command docker
            docker_run
            ;;
        docker-stop)
            check_command docker
            docker_stop
            ;;
        gh-pages)
            deploy_gh_pages
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
