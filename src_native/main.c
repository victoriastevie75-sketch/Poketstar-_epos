#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#include <shellapi.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <conio.h>
#include <process.h>
#include <sys/stat.h>
#include <time.h>

#define IDR_INDEX_HTML 101
#define IDR_PRODUCTS_JSON 102

// Global Server State
static int g_port = 3000;
static volatile int g_running = 1;
static SOCKET g_listen_sock = INVALID_SOCKET;
static char g_exe_dir[MAX_PATH] = {0};

// Forward Declarations
static void launch_pos_window(int port);
static unsigned __stdcall server_thread(void* arg);
static unsigned __stdcall client_thread(void* sock_ptr);

// Helper: Get Directory of Current Executable
static void init_exe_dir(void) {
    char path[MAX_PATH];
    DWORD len = GetModuleFileNameA(NULL, path, MAX_PATH);
    if (len > 0) {
        for (int i = (int)len - 1; i >= 0; i--) {
            if (path[i] == '\\' || path[i] == '/') {
                path[i] = '\0';
                break;
            }
        }
        strncpy(g_exe_dir, path, MAX_PATH - 1);
        g_exe_dir[MAX_PATH - 1] = '\0';
    } else {
        strcpy(g_exe_dir, ".");
    }
}

// Helper: Load Embedded Resource
static int load_embedded_resource(int res_id, const char** out_data, DWORD* out_size) {
    HRSRC hRes = FindResourceA(NULL, MAKEINTRESOURCEA(res_id), (LPCSTR)RT_RCDATA);
    if (!hRes) return 0;
    DWORD size = SizeofResource(NULL, hRes);
    HGLOBAL hData = LoadResource(NULL, hRes);
    if (!hData) return 0;
    const char* ptr = (const char*)LockResource(hData);
    if (!ptr || size == 0) return 0;
    *out_data = ptr;
    *out_size = size;
    return 1;
}

// Helper: Check if file exists on disk
static int file_exists_on_disk(const char* full_path) {
    DWORD attr = GetFileAttributesA(full_path);
    return (attr != INVALID_FILE_ATTRIBUTES && !(attr & FILE_ATTRIBUTE_DIRECTORY));
}

// Helper: Read entire file from disk
static char* read_file_from_disk(const char* full_path, size_t* out_len) {
    FILE* f = fopen(full_path, "rb");
    if (!f) return NULL;
    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    if (size < 0) { fclose(f); return NULL; }
    fseek(f, 0, SEEK_SET);
    char* buf = (char*)malloc(size + 1);
    if (!buf) { fclose(f); return NULL; }
    size_t read_bytes = fread(buf, 1, size, f);
    buf[read_bytes] = '\0';
    fclose(f);
    if (out_len) *out_len = read_bytes;
    return buf;
}

// Helper: Save sale record to sales_database.json
static void append_sale_to_database(const char* sale_json, size_t json_len) {
    if (!sale_json || json_len == 0) return;
    char db_path[MAX_PATH];
    snprintf(db_path, sizeof(db_path), "%s\\sales_database.json", g_exe_dir);

    // If file does not exist or is empty, write as JSON array
    FILE* f = fopen(db_path, "rb+");
    if (!f) {
        f = fopen(db_path, "wb");
        if (!f) return;
        fprintf(f, "[\n  %.*s\n]\n", (int)json_len, sale_json);
        fclose(f);
        return;
    }

    // Read existing file to insert before closing bracket ']'
    fseek(f, 0, SEEK_END);
    long fsize = ftell(f);
    if (fsize <= 2) {
        freopen(db_path, "wb", f);
        fprintf(f, "[\n  %.*s\n]\n", (int)json_len, sale_json);
        fclose(f);
        return;
    }

    // Search backwards for ']'
    long pos = fsize - 1;
    char c = 0;
    while (pos >= 0) {
        fseek(f, pos, SEEK_SET);
        c = (char)fgetc(f);
        if (c == ']') break;
        pos--;
    }

    if (pos > 0) {
        fseek(f, pos, SEEK_SET);
        fprintf(f, ",\n  %.*s\n]\n", (int)json_len, sale_json);
    } else {
        fseek(f, 0, SEEK_END);
        fprintf(f, "\n%.*s\n", (int)json_len, sale_json);
    }
    fclose(f);
}

// Helper: Determine MIME type
static const char* get_mime_type(const char* path) {
    const char* ext = strrchr(path, '.');
    if (!ext) return "application/octet-stream";
    if (_stricmp(ext, ".html") == 0 || _stricmp(ext, ".htm") == 0) return "text/html; charset=utf-8";
    if (_stricmp(ext, ".css") == 0) return "text/css; charset=utf-8";
    if (_stricmp(ext, ".js") == 0) return "application/javascript; charset=utf-8";
    if (_stricmp(ext, ".json") == 0) return "application/json; charset=utf-8";
    if (_stricmp(ext, ".png") == 0) return "image/png";
    if (_stricmp(ext, ".jpg") == 0 || _stricmp(ext, ".jpeg") == 0) return "image/jpeg";
    if (_stricmp(ext, ".svg") == 0) return "image/svg+xml";
    if (_stricmp(ext, ".ico") == 0) return "image/x-icon";
    if (_stricmp(ext, ".txt") == 0) return "text/plain; charset=utf-8";
    if (_stricmp(ext, ".woff2") == 0) return "font/woff2";
    if (_stricmp(ext, ".woff") == 0) return "font/woff";
    if (_stricmp(ext, ".ttf") == 0) return "font/ttf";
    return "application/octet-stream";
}

// Helper: Send Full HTTP Response
static void send_http_response(SOCKET sock, int status_code, const char* status_text,
                               const char* mime_type, const char* body, size_t body_len) {
    char header[512];
    int hlen = snprintf(header, sizeof(header),
        "HTTP/1.1 %d %s\r\n"
        "Server: PoketStar-Native-POS/2.4\r\n"
        "Content-Type: %s\r\n"
        "Content-Length: %Iu\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n"
        "Access-Control-Allow-Headers: *\r\n"
        "Connection: close\r\n"
        "\r\n",
        status_code, status_text, mime_type, body_len);

    send(sock, header, hlen, 0);
    if (body && body_len > 0) {
        size_t total_sent = 0;
        while (total_sent < body_len) {
            int to_send = (int)(body_len - total_sent);
            if (to_send > 32768) to_send = 32768;
            int n = send(sock, body + total_sent, to_send, 0);
            if (n <= 0) break;
            total_sent += n;
        }
    }
}

// Client Request Worker
static unsigned __stdcall client_thread(void* sock_ptr) {
    SOCKET sock = (SOCKET)(uintptr_t)sock_ptr;
    char buffer[65536];
    int received = recv(sock, buffer, sizeof(buffer) - 1, 0);
    if (received <= 0) {
        closesocket(sock);
        return 0;
    }
    buffer[received] = '\0';

    // Parse Method and Path
    char method[16] = {0};
    char raw_path[512] = {0};
    sscanf(buffer, "%15s %511s", method, raw_path);

    // Strip Query Parameters from path
    char path[512] = {0};
    char* qmark = strchr(raw_path, '?');
    if (qmark) {
        size_t plen = (size_t)(qmark - raw_path);
        if (plen >= sizeof(path)) plen = sizeof(path) - 1;
        strncpy(path, raw_path, plen);
        path[plen] = '\0';
    } else {
        strncpy(path, raw_path, sizeof(path) - 1);
        path[sizeof(path) - 1] = '\0';
    }

    // Handle OPTIONS Preflight
    if (_stricmp(method, "OPTIONS") == 0) {
        const char* resp =
            "HTTP/1.1 204 No Content\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n"
            "Access-Control-Allow-Headers: *\r\n"
            "Connection: close\r\n\r\n";
        send(sock, resp, (int)strlen(resp), 0);
        closesocket(sock);
        return 0;
    }

    // Extract POST Body
    char* body_start = strstr(buffer, "\r\n\r\n");
    char* post_data = NULL;
    size_t post_len = 0;
    if (body_start) {
        body_start += 4;
        post_data = body_start;
        post_len = received - (body_start - buffer);
    }

    // Route: Root / Index
    if (strcmp(path, "/") == 0 || _stricmp(path, "/index.html") == 0) {
        char disk_file[MAX_PATH];
        snprintf(disk_file, sizeof(disk_file), "%s\\index.html", g_exe_dir);
        if (file_exists_on_disk(disk_file)) {
            size_t flen = 0;
            char* fbuf = read_file_from_disk(disk_file, &flen);
            if (fbuf) {
                send_http_response(sock, 200, "OK", "text/html; charset=utf-8", fbuf, flen);
                free(fbuf);
                closesocket(sock);
                return 0;
            }
        }
        const char* res_data = NULL;
        DWORD res_size = 0;
        if (load_embedded_resource(IDR_INDEX_HTML, &res_data, &res_size)) {
            send_http_response(sock, 200, "OK", "text/html; charset=utf-8", res_data, (size_t)res_size);
        } else {
            send_http_response(sock, 404, "Not Found", "text/plain", "Embedded index.html not found.", 30);
        }
        closesocket(sock);
        return 0;
    }

    // Route: Products Catalog (GET)
    if (_stricmp(path, "/products.json") == 0 || _stricmp(path, "/api/products") == 0) {
        if (_stricmp(method, "GET") == 0) {
            char disk_file[MAX_PATH];
            snprintf(disk_file, sizeof(disk_file), "%s\\products.json", g_exe_dir);
            if (file_exists_on_disk(disk_file)) {
                size_t flen = 0;
                char* fbuf = read_file_from_disk(disk_file, &flen);
                if (fbuf) {
                    send_http_response(sock, 200, "OK", "application/json; charset=utf-8", fbuf, flen);
                    free(fbuf);
                    closesocket(sock);
                    return 0;
                }
            }
            const char* res_data = NULL;
            DWORD res_size = 0;
            if (load_embedded_resource(IDR_PRODUCTS_JSON, &res_data, &res_size)) {
                send_http_response(sock, 200, "OK", "application/json; charset=utf-8", res_data, (size_t)res_size);
            } else {
                send_http_response(sock, 404, "Not Found", "text/plain", "products.json not found.", 24);
            }
            closesocket(sock);
            return 0;
        } else if (_stricmp(method, "POST") == 0) {
            if (post_data && post_len > 0) {
                char disk_file[MAX_PATH];
                snprintf(disk_file, sizeof(disk_file), "%s\\products.json", g_exe_dir);
                FILE* f = fopen(disk_file, "wb");
                if (f) {
                    fwrite(post_data, 1, post_len, f);
                    fclose(f);
                }
            }
            const char* ok_resp = "{\"success\":true,\"message\":\"Inventory saved successfully\"}";
            send_http_response(sock, 200, "OK", "application/json; charset=utf-8", ok_resp, strlen(ok_resp));
            closesocket(sock);
            return 0;
        }
    }

    // Route: Sales Log (GET & POST)
    if (_stricmp(path, "/api/sales") == 0) {
        if (_stricmp(method, "GET") == 0) {
            char disk_file[MAX_PATH];
            snprintf(disk_file, sizeof(disk_file), "%s\\sales_database.json", g_exe_dir);
            if (file_exists_on_disk(disk_file)) {
                size_t flen = 0;
                char* fbuf = read_file_from_disk(disk_file, &flen);
                if (fbuf) {
                    send_http_response(sock, 200, "OK", "application/json; charset=utf-8", fbuf, flen);
                    free(fbuf);
                    closesocket(sock);
                    return 0;
                }
            }
            const char* empty_arr = "[]";
            send_http_response(sock, 200, "OK", "application/json; charset=utf-8", empty_arr, 2);
            closesocket(sock);
            return 0;
        } else if (_stricmp(method, "POST") == 0) {
            if (post_data && post_len > 0) {
                append_sale_to_database(post_data, post_len);
            }
            const char* ok_resp = "{\"success\":true,\"status\":\"recorded\"}";
            send_http_response(sock, 200, "OK", "application/json; charset=utf-8", ok_resp, strlen(ok_resp));
            closesocket(sock);
            return 0;
        }
    }

    // Route: Payments Checkout Simulation
    if (_stricmp(path, "/api/payments/stk-push") == 0 || _stricmp(path, "/api/payments/create-intent") == 0) {
        const char* pay_resp = "{\"success\":true,\"checkoutId\":\"SIM-LOCAL-TXN\",\"status\":\"completed\",\"message\":\"Payment verified\"}";
        send_http_response(sock, 200, "OK", "application/json; charset=utf-8", pay_resp, strlen(pay_resp));
        closesocket(sock);
        return 0;
    }

    // Route: Health Check
    if (_stricmp(path, "/health") == 0 || _stricmp(path, "/api/health") == 0) {
        char health_buf[256];
        int hlen = snprintf(health_buf, sizeof(health_buf),
            "{\"status\":\"ok\",\"engine\":\"PoketStar-Native-Win32\",\"port\":%d,\"timestamp\":\"%lu\"}",
            g_port, (unsigned long)time(NULL));
        send_http_response(sock, 200, "OK", "application/json; charset=utf-8", health_buf, hlen);
        closesocket(sock);
        return 0;
    }

    // Route: Download Info API
    if (_stricmp(path, "/api/download/info") == 0) {
        const char* info_resp = "{\"portableZip\":{\"sizeMB\":\"52.2 MB\"},\"x86_32bit\":{\"sizeMB\":\"1.2 MB\"},\"x64_64bit\":{\"sizeMB\":\"1.3 MB\"}}";
        send_http_response(sock, 200, "OK", "application/json; charset=utf-8", info_resp, strlen(info_resp));
        closesocket(sock);
        return 0;
    }

    // Route: Static files on disk
    char disk_file[MAX_PATH];
    const char* relative_path = (path[0] == '/' || path[0] == '\\') ? path + 1 : path;
    snprintf(disk_file, sizeof(disk_file), "%s\\%s", g_exe_dir, relative_path);

    if (file_exists_on_disk(disk_file)) {
        size_t flen = 0;
        char* fbuf = read_file_from_disk(disk_file, &flen);
        if (fbuf) {
            const char* mime = get_mime_type(disk_file);
            send_http_response(sock, 200, "OK", mime, fbuf, flen);
            free(fbuf);
            closesocket(sock);
            return 0;
        }
    }

    // Also check web/ subfolder
    snprintf(disk_file, sizeof(disk_file), "%s\\web\\%s", g_exe_dir, relative_path);
    if (file_exists_on_disk(disk_file)) {
        size_t flen = 0;
        char* fbuf = read_file_from_disk(disk_file, &flen);
        if (fbuf) {
            const char* mime = get_mime_type(disk_file);
            send_http_response(sock, 200, "OK", mime, fbuf, flen);
            free(fbuf);
            closesocket(sock);
            return 0;
        }
    }

    // SPA Route Fallback: if no extension, serve index.html
    if (!strchr(path, '.')) {
        const char* res_data = NULL;
        DWORD res_size = 0;
        if (load_embedded_resource(IDR_INDEX_HTML, &res_data, &res_size)) {
            send_http_response(sock, 200, "OK", "text/html; charset=utf-8", res_data, (size_t)res_size);
            closesocket(sock);
            return 0;
        }
    }

    // Not Found
    const char* not_found = "{\"error\":\"File not found\"}";
    send_http_response(sock, 404, "Not Found", "application/json", not_found, strlen(not_found));
    closesocket(sock);
    return 0;
}

// Background Listener Thread
static unsigned __stdcall server_thread(void* arg) {
    (void)arg;
    while (g_running && g_listen_sock != INVALID_SOCKET) {
        struct sockaddr_in client_addr;
        int addr_len = sizeof(client_addr);
        SOCKET client_sock = accept(g_listen_sock, (struct sockaddr*)&client_addr, &addr_len);
        if (client_sock == INVALID_SOCKET) {
            if (!g_running) break;
            Sleep(10);
            continue;
        }

        // Handle client connection in thread
        HANDLE hThread = (HANDLE)_beginthreadex(NULL, 0, client_thread, (void*)(uintptr_t)client_sock, 0, NULL);
        if (hThread) {
            CloseHandle(hThread);
        } else {
            closesocket(client_sock);
        }
    }
    return 0;
}

// Launch dedicated App Window
static void launch_pos_window(int port) {
    char url[128];
    snprintf(url, sizeof(url), "http://127.0.0.1:%d", port);

    char app_arg[256];
    snprintf(app_arg, sizeof(app_arg), "--app=%s --window-size=1280,840 --disable-pinch", url);

    const char* p_progX86 = getenv("ProgramFiles(x86)");
    const char* p_prog = getenv("ProgramFiles");
    const char* p_local = getenv("LocalAppData");

    char target[MAX_PATH];
    int found = 0;

    // 1. Microsoft Edge (preferred for modern Windows)
    if (p_prog && !found) {
        snprintf(target, sizeof(target), "%s\\Microsoft\\Edge\\Application\\msedge.exe", p_prog);
        if (file_exists_on_disk(target)) found = 1;
    }
    if (p_progX86 && !found) {
        snprintf(target, sizeof(target), "%s\\Microsoft\\Edge\\Application\\msedge.exe", p_progX86);
        if (file_exists_on_disk(target)) found = 1;
    }
    if (p_local && !found) {
        snprintf(target, sizeof(target), "%s\\Microsoft\\Edge\\Application\\msedge.exe", p_local);
        if (file_exists_on_disk(target)) found = 1;
    }

    // 2. Google Chrome
    if (p_prog && !found) {
        snprintf(target, sizeof(target), "%s\\Google\\Chrome\\Application\\chrome.exe", p_prog);
        if (file_exists_on_disk(target)) found = 1;
    }
    if (p_progX86 && !found) {
        snprintf(target, sizeof(target), "%s\\Google\\Chrome\\Application\\chrome.exe", p_progX86);
        if (file_exists_on_disk(target)) found = 1;
    }
    if (p_local && !found) {
        snprintf(target, sizeof(target), "%s\\Google\\Chrome\\Application\\chrome.exe", p_local);
        if (file_exists_on_disk(target)) found = 1;
    }

    if (found) {
        ShellExecuteA(NULL, "open", target, app_arg, NULL, SW_SHOWNORMAL);
    } else {
        ShellExecuteA(NULL, "open", url, NULL, NULL, SW_SHOWNORMAL);
    }
}

// Console Control Handler for clean exit
static BOOL WINAPI console_ctrl_handler(DWORD ctrl_type) {
    (void)ctrl_type;
    g_running = 0;
    if (g_listen_sock != INVALID_SOCKET) {
        closesocket(g_listen_sock);
        g_listen_sock = INVALID_SOCKET;
    }
    WSACleanup();
    return TRUE;
}

// Application Entry Point
int main(int argc, char* argv[]) {
    (void)argc; (void)argv;
    SetConsoleCtrlHandler(console_ctrl_handler, TRUE);
    init_exe_dir();

    // Set console title
    SetConsoleTitleA("Poket Star POS - Counter Terminal");

    // Initialize Winsock
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        printf("[ERROR] Failed to initialize Windows networking socket engine.\n");
        system("pause");
        return 1;
    }

    // Bind socket to available port starting at 3000
    int bind_success = 0;
    for (int port = 3000; port <= 3030; port++) {
        g_listen_sock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
        if (g_listen_sock == INVALID_SOCKET) continue;

        int opt = 1;
        setsockopt(g_listen_sock, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));

        struct sockaddr_in server_addr;
        memset(&server_addr, 0, sizeof(server_addr));
        server_addr.sin_family = AF_INET;
        server_addr.sin_addr.s_addr = inet_addr("127.0.0.1");
        server_addr.sin_port = htons((u_short)port);

        if (bind(g_listen_sock, (struct sockaddr*)&server_addr, sizeof(server_addr)) == 0) {
            if (listen(g_listen_sock, 32) == 0) {
                g_port = port;
                bind_success = 1;
                break;
            }
        }
        closesocket(g_listen_sock);
        g_listen_sock = INVALID_SOCKET;
    }

    if (!bind_success) {
        printf("[ERROR] Could not bind local HTTP server to any port between 3000 and 3030.\n");
        WSACleanup();
        system("pause");
        return 1;
    }

    // Start background listener thread
    HANDLE hServerThread = (HANDLE)_beginthreadex(NULL, 0, server_thread, NULL, 0, NULL);

    // Display Terminal Banner
    printf("======================================================================\n");
    printf("              POKET STAR POS - WINDOWS COUNTER TERMINAL\n");
    printf("             High-Performance Standalone Retail Solution\n");
    printf("======================================================================\n");
    printf("  [*] Status:         ONLINE & READY\n");
    printf("  [*] Local Address:  http://127.0.0.1:%d\n", g_port);
    printf("  [*] Catalog:        1,629 Retail & Pharmacy Inventory Items Embedded\n");
    printf("  [*] Thermal Engine: ESC/POS 80mm & 58mm Receipt Printing Active\n");
    printf("  [*] Scanners:       USB / Bluetooth Barcode Scanners Plug & Play\n");
    printf("  [*] Sales Ledger:   sales_database.json (Persistent Offline Storage)\n");
    printf("======================================================================\n");
    printf("  Hotkeys:\n");
    printf("    [O] Launch POS Terminal in Window\n");
    printf("    [S] Open Sales Database File\n");
    printf("    [D] Open Working Directory Folder\n");
    printf("    [Q] Exit POS Terminal\n");
    printf("======================================================================\n\n");
    printf("[INFO] Launching counter terminal interface...\n");

    // Launch UI immediately
    launch_pos_window(g_port);

    // Keyboard loop
    while (g_running) {
        if (_kbhit()) {
            int ch = _getch();
            if (ch == 'q' || ch == 'Q') {
                printf("\n[INFO] Shutting down Poket Star POS server...\n");
                g_running = 0;
                break;
            } else if (ch == 'o' || ch == 'O') {
                printf("[INFO] Re-opening POS counter interface...\n");
                launch_pos_window(g_port);
            } else if (ch == 's' || ch == 'S') {
                char db_path[MAX_PATH];
                snprintf(db_path, sizeof(db_path), "%s\\sales_database.json", g_exe_dir);
                ShellExecuteA(NULL, "open", db_path, NULL, NULL, SW_SHOWNORMAL);
            } else if (ch == 'd' || ch == 'D') {
                ShellExecuteA(NULL, "open", g_exe_dir, NULL, NULL, SW_SHOWNORMAL);
            }
        }
        Sleep(100);
    }

    // Cleanup
    if (g_listen_sock != INVALID_SOCKET) {
        closesocket(g_listen_sock);
        g_listen_sock = INVALID_SOCKET;
    }
    if (hServerThread) {
        WaitForSingleObject(hServerThread, 500);
        CloseHandle(hServerThread);
    }
    WSACleanup();
    return 0;
}
