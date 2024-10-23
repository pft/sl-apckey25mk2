from pyliblo3 import *
import time
from os import listdir
from os.path import isfile, join
import argparse
parser = argparse.ArgumentParser(
                    prog='sessions',
                    description='List sooperlooper sessions in the specified directory',
                    epilog='')

parser.add_argument('sessiondir')           # positional argument

args = parser.parse_args()
print(args.sessiondir)

mypath = args.sessiondir

class MyServer(ServerThread):
    def __init__(self, port=1234):
        ServerThread.__init__(self, port)

    @make_method('/sessions', None)
    def foo_callback(self, path, args):
        asker,port,address = args             #
        onlyfiles = [f for f in listdir(mypath) if isfile(join(mypath, f)) and f.endswith('.slsess')]
        print(f"Received message '{path}' without argument {asker=} {port=} {address=} {onlyfiles=}")
        send((asker, port), address, *onlyfiles)

    @make_method(None, None)
    def fallback(self, path, args):
        print(f"received unknown message '{path}' with {args=}")


server = MyServer()
server.start()
print(f"Server started in its own thread, send messages to {server.port}. Use CTRL-C to stop")

while True:
    send(("127.0.0.0", server.port), "/sessions", "127.0.0.1", 1234, "/sesions")
    # send(("127.0.0.0", server.port), "/unknown", (3, 4))
    time.sleep(1)
