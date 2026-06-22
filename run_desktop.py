import os
import sys
import threading
import time
import uvicorn
import webview
import socket

# Add the root folder to the path so we can import backend as a package
sys.path.append(os.path.dirname(__file__))

from backend.main import app

def get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

def run_server(port):
    uvicorn.run("backend.main:app", host="127.0.0.1", port=port, log_level="error")

def cleanup_document_list():
    import sqlite3
    db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "sql_app.db"))
    if not os.path.exists(db_path):
        return
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if table 'documents' exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='documents'")
        if not cursor.fetchone():
            conn.close()
            return
            
        cursor.execute("PRAGMA table_info(documents)")
        columns = [col[1] for col in cursor.fetchall()]
        
        has_is_archived = "is_archived" in columns
        has_filepath = "filepath" in columns
        
        if has_filepath:
            if has_is_archived:
                cursor.execute("SELECT filepath FROM documents WHERE is_archived = 0")
            else:
                cursor.execute("SELECT filepath FROM documents")
            rows = cursor.fetchall()
            for row in rows:
                filepath = row[0]
                if filepath and os.path.exists(filepath):
                    try:
                        os.remove(filepath)
                    except Exception as e:
                        print(f"Error removing temporary file {filepath}: {e}")
        cursor.execute("DELETE FROM documents WHERE is_archived = 0")
        conn.commit()
        conn.close()
        print("Document list cleaned successfully.")
    except Exception as e:
        print(f"Error cleaning document list: {e}")

if __name__ == '__main__':
    # Make sure we run from the correct directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Set AppUserModelID to ensure the custom taskbar icon is displayed correctly on Windows
    if sys.platform == 'win32':
        import ctypes
        try:
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("Company.DocManager.App.1")
        except Exception as e:
            print(f"Error setting AppUserModelID: {e}")
            
    port = get_free_port()
    
    # Start the FastAPI server in a background thread
    server_thread = threading.Thread(target=run_server, args=(port,), daemon=True)
    server_thread.start()
    
    # Give the server a moment to start
    time.sleep(1)
    
    # Open the PyWebView window pointing to the local server
    window = webview.create_window(
        '智能文档管理中心 (Intelligent Document Management)', 
        f'http://127.0.0.1:{port}/',
        width=1200, 
        height=800,
        min_size=(800, 600)
    )
    
    def set_icon_on_shown():
        try:
            # Poll for window.native to become available (up to 5 seconds)
            for _ in range(50):
                if window.native:
                    hwnd = window.native.Handle.ToInt64()
                    icon_path = os.path.abspath("app.ico")
                    if os.path.exists(icon_path):
                        import ctypes
                        WM_SETICON = 0x0080
                        ICON_SMALL = 0
                        ICON_BIG = 1
                        IMAGE_ICON = 1
                        LR_LOADFROMFILE = 0x00000010
                        LR_DEFAULTSIZE = 0x00000040
                        
                        user32 = ctypes.windll.user32
                        hicon = user32.LoadImageW(
                            None,
                            icon_path,
                            IMAGE_ICON,
                            0, 0,
                            LR_LOADFROMFILE | LR_DEFAULTSIZE
                        )
                        if hicon:
                            user32.SendMessageW(hwnd, WM_SETICON, ICON_SMALL, hicon)
                            user32.SendMessageW(hwnd, WM_SETICON, ICON_BIG, hicon)
                            print("Successfully set window icon via WM_SETICON")
                            break
                time.sleep(0.1)
        except Exception as e:
            print(f"Error setting window icon: {e}")

    if sys.platform == 'win32':
        threading.Thread(target=set_icon_on_shown, daemon=True).start()
    
    def on_closing():
        # Display custom Chinese exit confirmation dialog
        result = window.create_confirmation_dialog('退出系统', '您确定要退出系统吗？退出后将自动清理未归档的临时文档列表。')
        return result
        
    window.events.closing += on_closing
    
    webview.start(icon='app.ico')
    
    # Execute cleanup after GUI exits
    cleanup_document_list()


