//+ build js,wasm

package main

import (
	"errors"
	"syscall/js"

	"../../../gobridge"
)

var global = js.Global()

func add(this js.Value, args []js.Value) (interface{}, error) {
	ret := 0

	for _, item := range args {
		// val, _ := strconv.Atoi(item.String())
		// println(val)
		ret += item.Int()
	}
	println(ret)
	return ret, nil
}

func err(this js.Value, args []js.Value) (interface{}, error) {
	return nil, errors.New("This is an error")
}

func main() {
	c := make(chan struct{}, 0)
	gobridge.RegisterCallback("add", add)
	gobridge.RegisterCallback("raiseError", err)
	gobridge.RegisterValue("someValue", "Hello World")

	<-c
}
