from logging import INFO, StreamHandler, basicConfig
from logging.handlers import TimedRotatingFileHandler


def setup_logging():
    file_log = TimedRotatingFileHandler("./logs/app.log", when="d", interval=1)
    console_log = StreamHandler()
    basicConfig(
        level=INFO,
        format="%(asctime)s %(levelname).4s %(name)s %(lineno)d %(message)s",
        handlers=[file_log, console_log],
    )
