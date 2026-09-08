git filter-branch --msg-filter '
  sed -e "s/^chore:/fix:/" -e "s/^docs:/fix:/"
' 641cdc2..HEAD
