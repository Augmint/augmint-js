#!/usr/bin/env bash
DOCKER_IMAGE=augmint/contracts:v1.0.4
CONTAINER_NAME=ganache

echo ""
echo "augmint-cli : start / stop augmint contracts. Docker image: $DOCKER_IMAGE"
echo ""

if ! [ -x "$(command -v docker)" ] ; then
  echo 'Error: docker is not installed.' >&2
  exit 1
fi

case "$1" in
    ganache )
        case "$2" in
            start )
                docker start ganache || \
                docker run --init --name $CONTAINER_NAME -p 8545:8545 $DOCKER_IMAGE --db ./dockerLocalchaindb \
                --gasLimit 0x47D5DE --gasPrice 1000000000 --networkId 999 \
                -m \"hello build tongue rack parade express shine salute glare rate spice stock\"
            ;;

            stop )
                docker stop ganache
            ;;

            * )

            echo "Usage: $0 ganache {start | stop}"
            ;;
        esac
        ;;

    *)
        echo "Usage: $0 ganache {start | stop}"
        ;;
esac