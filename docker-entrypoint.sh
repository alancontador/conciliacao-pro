#!/bin/sh
# Gera env-config.js com as variáveis de ambiente do container em runtime
cat > /usr/share/nginx/html/env-config.js << EOF
window.__env = {
  VITE_SUPABASE_URL: '${VITE_SUPABASE_URL}',
  VITE_SUPABASE_ANON_KEY: '${VITE_SUPABASE_ANON_KEY}',
};
EOF

echo "env-config.js gerado com VITE_SUPABASE_URL=${VITE_SUPABASE_URL}"
exec nginx -g 'daemon off;'
