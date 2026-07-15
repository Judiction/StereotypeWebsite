## Github Pages Server Simulator##

# um mini servidor que simula o Github Pages
# redirecionando para "404.html" quando a rota (arquivo) nao eh encontrada.

#criado para testar o gerenciamento de rotas (404.html, index.html) 

# para rodar o site utilizando ele, digite "python3 gh_pages_server.py" no terminal! 

import http.server
import os

PORT = 8080

class GitHubPagesHandler(http.server.SimpleHTTPRequestHandler):
    def send_error(self, code, message=None, explain=None):
        if code == 404:
            self.serve_404()
        else:
            super().send_error(code, message, explain)

    def serve_404(self):
        try:
            with open("404.html", "rb") as f:
                content = f.read()
        except FileNotFoundError:
            content = b"404 Not Found"

        self.send_response(404)
        self.send_header("Content-Type", "text/html")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

os.chdir(os.path.dirname(os.path.abspath(__file__)))  # serve from this script's folder

with http.server.HTTPServer(("", PORT), GitHubPagesHandler) as httpd:
    print(f"Serving at http://localhost:{PORT}")
    httpd.serve_forever()