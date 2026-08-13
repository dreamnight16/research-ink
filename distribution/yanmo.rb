# Homebrew formula for 研墨 (YanMo)
# brew tap dreamnight16/yanmo
# brew install yanmo

class Yanmo < Formula
  desc "Local-first AI research assistant for academia"
  homepage "https://github.com/dreamnight16/Yanmo"
  url "https://github.com/dreamnight16/Yanmo/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "PLACEHOLDER"
  license "MIT"

  depends_on "python@3.11"
  depends_on "node"
  depends_on "ollama"

  def install
    libexec.install Dir["*"]
    cd libexec do
      system "pip3", "install", "-e", ".[dev]"
    end
    (bin/"yanmo-backend").write <<~EOS
      #!/bin/bash
      cd #{libexec} && python3 -m backend.main
    EOS
    (bin/"yanmo-frontend").write <<~EOS
      #!/bin/bash
      cd #{libexec}/frontend && npm run dev
    EOS
    chmod 0755, bin/"yanmo-backend", bin/"yanmo-frontend"
  end

  def caveats
    <<~EOS
      Start the backend: yanmo-backend
      Start the frontend: yanmo-frontend
      Data directory: ~/.yanmo/
    EOS
  end

  test do
    system "python3", "-c", "from backend.core.config import Config; assert Config()"
  end
end
