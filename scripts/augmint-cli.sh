#!/usr/bin/env bash
DOCKER_IMAGE=augmint/contracts:v1.0.9
CONTAINER_NAME=ganache

echo ""
echo "augmint-cli : start / stop augmint contracts. Docker image: $DOCKER_IMAGE"
echo ""

if ! [ -x "$(command -v docker)" ] ; then
  echo 'Error: docker is not installed.' >&2
  exit 1
fi

function run_ganache {
    docker run --init --detach --name $CONTAINER_NAME -p 8545:8545 $DOCKER_IMAGE --db ./dockerLocalchaindb \
                --gasLimit 0x47D5DE --gasPrice 1000000000 --networkId 999 \
                -m "hello build tongue rack parade express shine salute glare rate spice stock"
}

function stop_container_if_running {
    if [ "$(docker ps --quiet --filter name=^/$CONTAINER_NAME$)" ]; then
        echo "Container '$CONTAINER_NAME' is running. Stopping."
        docker stop $CONTAINER_NAME
    fi
}

function remove_container_if_image_mismatched {
    existingImage=$(docker ps --quiet -all --format "{{.Image}}" --filter name=^/$CONTAINER_NAME$)

    if [ "$existingImage" != "" -a "$existingImage" != "$DOCKER_IMAGE" ]; then
        echo "WARNING: ganache docker container image mismatch."
        echo "  There is already a docker container named '$CONTAINER_NAME' using image $existingImage."
        echo "  expected image is $DOCKER_IMAGE for current augmint.js version."
        echo "  It's likely because of an augmint-js upgrade since last local run of container. Removing existing $CONTAINER_NAME container."

        stop_container_if_running
        
        docker rm $CONTAINER_NAME
    fi
}


function print_instructions {
    echo "    Usage: $0 ganache {start | stop | run}"
    echo "      start: tries to start container named $CONTAINER_NAME . If fails then runs (downloads, creates and starts) the container from $DOCKER_IMAGE"
    echo "      stop: plain docker stop $DOCKER_IMAGE (doesn't check if exists)"
    echo "      run: stops and removes the $CONTAINER_NAME container if exists. then runs it "
}

case "$1" in
    ganache )
        case "$2" in
            run )
                remove_container_if_image_mismatched

                stop_container_if_running

                if [ "$(docker ps --quiet -all --filter name=^/$CONTAINER_NAME$)" ]; then
                    echo "Container '$CONTAINER_NAME' exists. Removing before run."
                    docker rm $CONTAINER_NAME
                fi

                run_ganache
            ;;

            start )     
                remove_container_if_image_mismatched

                if [ "$(docker ps --quiet -all --filter name=^/$CONTAINER_NAME$)" ]; then
                    docker start $CONTAINER_NAME
                else
                    echo "Container '$CONTAINER_NAME' doesn't exist. Using docker run to create and start."
                    run_ganache
                fi
            ;;

            stop )
                docker stop ganache
            ;;

            * )
                print_instructions
            ;;

        esac
        ;;

    *)
        print_instructions
        ;;
esac