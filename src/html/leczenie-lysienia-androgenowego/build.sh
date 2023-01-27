REPO=feegloo.github.io
DOC_ID=1AP6wBUaiLK7k6D0QhHmPDpCbhq1ZL_9q3DSI2TZxDLM
PDF="Leczenie łysienia androgenowego u mężczyzn.pdf"
REPO_NOT_EXISTS="[ ! -d $REPO ]"

$REPO_NOT_EXISTS && git clone "https://github.com/feegloo/$REPO".git

# download Google Drive Doc as PDF ("shared by link" for view with anyone - allows download without auth)
curl -o "$REPO/$PDF" -L "https://docs.google.com/document/export?format=pdf&id=$DOC_ID" 

cd $REPO &&
git add . &&
git commit -m "update $PDF" &&
git pull -r &&
git push

$REPO_NOT_EXISTS && cd .. && rm -fr $REPO
