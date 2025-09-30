#!/bin/bash

# RealEstate AI Agent - Quick Deploy Script

echo "🚀 RealEstate AI Agent - Deployment Helper"
echo ""

# Check if backend URL is provided
if [ -z "$1" ]; then
  echo "❌ Error: Please provide your backend URL"
  echo ""
  echo "Usage: ./deploy.sh <backend-url>"
  echo "Example: ./deploy.sh https://realestate-ai-agent.onrender.com"
  exit 1
fi

BACKEND_URL=$1

echo "📝 Configuration:"
echo "   Backend URL: $BACKEND_URL"
echo ""

# Update production environment file
echo "1️⃣  Updating frontend environment configuration..."
cat > deal-agent-ui/src/environments/environment.prod.ts <<EOF
// Production environment (cloud)
export const environment = {
  production: true,
  apiUrl: '$BACKEND_URL'
};
EOF

echo "   ✅ Updated environment.prod.ts"
echo ""

# Build frontend
echo "2️⃣  Building frontend for production..."
cd deal-agent-ui
npm run build
if [ $? -eq 0 ]; then
  echo "   ✅ Frontend build successful"
else
  echo "   ❌ Frontend build failed"
  exit 1
fi
cd ..
echo ""

# Git commit changes
echo "3️⃣  Committing changes to git..."
git add .
git commit -m "Update production backend URL to $BACKEND_URL"
echo "   ✅ Changes committed"
echo ""

# Instructions for next steps
echo "4️⃣  Next steps:"
echo ""
echo "   To deploy backend to Render:"
echo "   $ git push origin main"
echo "   (Render will auto-deploy)"
echo ""
echo "   To deploy frontend to Vercel:"
echo "   $ cd deal-agent-ui && vercel --prod"
echo ""
echo "   To deploy frontend to Netlify:"
echo "   $ cd deal-agent-ui && netlify deploy --prod"
echo ""
echo "   To deploy frontend to Render:"
echo "   Push to git, Render will auto-deploy"
echo ""
echo "✅ Deployment preparation complete!"
echo ""
echo "📍 Your URLs:"
echo "   Frontend: https://deal-agent-ui.onrender.com (or your custom domain)"
echo "   Backend: $BACKEND_URL"
