#!/bin/sh

cat >./dist/sourcefile-map.json <<EOF
[
    {
      "pattern": "^",
      "replace":   "${REPOSITORY_URL}/tree/${BRANCH}/src/"
    }
]
EOF

typedoc \
--out ./dist/docs ./src \
--mode modules \
--target ES6 \
--tsconfig ./tsconfig.json \
--exclude node_modules \
--ignoreCompilerErrors \
--excludeExternals \
--excludePrivate \
--excludeNotExported \
--sourcefile-url-map ./dist/sourcefile-map.json