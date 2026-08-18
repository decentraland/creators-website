
#!/bin/bash

OFF='\033[0m'
GREEN='\033[0;32m'
GREY='\033[0;90m'

## Title
echo "";
echo "Decentraland dApps Template for Projects";
echo "";

## Ask for project name
PROJECT_NAME_RETTRY=0
while [[ $PROJECT_NAME == "" ]]; do
  if [[ $PROJECT_NAME_RETTRY == 0 ]]; then
    read -p "$(echo -e ${GREEN}~ Enter project name: ${OFF})" PROJECT_NAME
  else
    read -p "$(echo -e ${GREEN}~ Please enter project name: ${OFF})" PROJECT_NAME
  fi

  PROJECT_NAME_RETTRY=$PROJECT_NAME_RETTRY+1
done

echo -e "${GREEN}~ Creating: ${GREY}.github/workflows/pull-request.yml${OFF}";
rm ".github/workflows/pull-request.yml";
mv ".github/workflows/build-release.yml.example" ".github/workflows/build-release.yml";
mv ".github/workflows/set-rollout-manual.yml.example" ".github/workflows/set-rollout-manual.yml";
mv ".github/workflows/set-rollout.yml.example" ".github/workflows/set-rollout.yml";
sed -i "" -e "s/{{project_name}}/$PROJECT_NAME/g" ".github/workflows/set-rollout-manual.yml";
sed -i "" -e "s/{{project_name}}/$PROJECT_NAME/g" ".github/workflows/set-rollout.yml";
sed -i "" -e "s/{{project_name}}/$PROJECT_NAME/g" "package.json";
sed -i "" -e "s/dapps-template/$PROJECT_NAME/g" "package.json";
sed -i "" -e "s/Starter template for Decentraland dApps Repositories//g" "package.json";
sed -i "" -e "s/{{project_name}}/$PROJECT_NAME/g" "public/package.json";
sed -i "" -e "s/dapps-template/$PROJECT_NAME/g" "public/package.json";
sed -i "" -e "s/Starter template for Decentraland dApps Repositories//g" "public/package.json";
sed -i "" -e "s/{{project_name}}/$PROJECT_NAME/g" "package-lock.json";

sed -i "" -e "s/Decentraland dApp template/$PROJECT_NAME/g" "README.md";
sed -i "" -e '8d' "package.json"; ## This will delete the line 8

echo -e "${GREEN}~ Removing: ${GREY}start.sh${OFF}"
rm start.sh

echo -e "${GREEN}~ Installing dependencies...${OFF}"
npm ci

echo -e "${GREEN}~ Creating folder tree...${OFF}"
mkdir src/components
mkdir src/hooks
mkdir src/images
mkdir src/modules

echo -e "${GREEN}~ Restarting GIT...${OFF}"
rm -Rf .git && \
  git init && \
  git add . && \
  git commit -m "feat: initial commit"

echo -e "${GREEN}~ Done!${OFF}"
