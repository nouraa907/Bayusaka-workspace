(function () {
    var USERS_KEY = "bayusaka_users";
    var SESSION_KEY = "bayusaka_session";
    var DATE_FIELDS = ["jadwal", "deadline", "tanggal"];

    /* ---------- Helper ---------- */
    function read(key, fallback) {
        try {
            var value = JSON.parse(localStorage.getItem(key));
            return value === null || value === undefined ? fallback : value;
        } catch (e) {
            return fallback;
        }
    }

    function write(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function hashPassword(text) {
        var h = 5381;
        for (var i = 0; i < text.length; i++) {
            h = ((h << 5) + h) + text.charCodeAt(i);
            h |= 0;
        }
        return String(h);
    }

    function escapeHtml(text) {
        return String(text).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function slug(text) {
        return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    }

    function parseDate(text) {
        var p = text.split("-");
        return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    }

    function todayDate() {
        var d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function daysLeft(text) {
        return Math.round((parseDate(text) - todayDate()) / 86400000);
    }

    function fmtDate(text) {
        var p = text.split("-");
        return p[2] + "/" + p[1] + "/" + p[0];
    }

    function dayLabel(diff) {
        if (diff < 0) return "Terlambat " + (-diff) + " hari";
        if (diff === 0) return "Hari ini";
        if (diff === 1) return "Besok";
        return "H-" + diff;
    }

    function dayLevel(diff) {
        if (diff < 0) return "late";
        if (diff === 0) return "today";
        if (diff === 1) return "tomorrow";
        return "soon";
    }

    /* ---------- Cek login ---------- */
    var users = read(USERS_KEY, {});
    var session = localStorage.getItem(SESSION_KEY);
    var loggedIn = !!(session && users[session]);

    if (window.PUBLIC_PAGE) {
        if (loggedIn) {
            location.replace("index.html");
            return;
        }
    } else if (!loggedIn) {
        location.replace("login.html");
        return;
    }

    // Data setiap akun dipisah berdasarkan username
    function dataKey(store) {
        return "bayusaka_" + session + "_" + store;
    }

    /* ---------- Pengingat ---------- */
    function getReminders() {
        var list = [];

        read(dataKey("projects"), []).forEach(function (p) {
            if (p.status === "Selesai" || !p.deadline) return;
            var diff = daysLeft(p.deadline);
            if (diff <= 7) {
                list.push({
                    diff: diff,
                    type: "Project",
                    title: p.project,
                    meta: "PIC: " + (p.pic || "-") + " | Deadline " + fmtDate(p.deadline),
                    href: "projects.html"
                });
            }
        });

        read(dataKey("content"), []).forEach(function (c) {
            if (c.status === "Sudah Posting" || !c.jadwal) return;
            var diff = daysLeft(c.jadwal);
            if (diff <= 7) {
                list.push({
                    diff: diff,
                    type: "Konten",
                    title: c.judul,
                    meta: "PIC: " + (c.pic || "-") + " | Posting " + fmtDate(c.jadwal),
                    href: "content.html"
                });
            }
        });

        list.sort(function (a, b) { return a.diff - b.diff; });
        return list;
    }

    /* ---------- Login & Daftar ---------- */
    function initLogin() {
        var loginForm = document.getElementById("login-form");
        var registerForm = document.getElementById("register-form");
        var message = document.getElementById("auth-message");
        if (!loginForm || !registerForm) return;

        var tabs = document.querySelectorAll(".tab");

        function showMessage(text, ok) {
            message.textContent = text;
            message.className = "auth-message " + (ok ? "ok" : "error");
        }

        tabs.forEach(function (tab) {
            tab.addEventListener("click", function () {
                var target = tab.getAttribute("data-tab");
                tabs.forEach(function (t) { t.classList.toggle("active", t === tab); });
                loginForm.hidden = target !== "login";
                registerForm.hidden = target !== "register";
                message.textContent = "";
                message.className = "auth-message";
            });
        });

        loginForm.addEventListener("submit", function (event) {
            event.preventDefault();
            var username = loginForm.elements.username.value.trim().toLowerCase();
            var password = loginForm.elements.password.value;
            var all = read(USERS_KEY, {});

            if (!all[username] || all[username].password !== hashPassword(password)) {
                showMessage("Username atau password salah.", false);
                return;
            }
            localStorage.setItem(SESSION_KEY, username);
            location.replace("index.html");
        });

        registerForm.addEventListener("submit", function (event) {
            event.preventDefault();
            var name = registerForm.elements.name.value.trim();
            var username = registerForm.elements.username.value.trim().toLowerCase();
            var password = registerForm.elements.password.value;
            var confirm = registerForm.elements.confirm.value;
            var all = read(USERS_KEY, {});

            if (!/^[a-z0-9._-]{3,20}$/.test(username)) {
                showMessage("Username 3-20 karakter: huruf kecil, angka, titik, atau strip.", false);
                return;
            }
            if (password.length < 6) {
                showMessage("Password minimal 6 karakter.", false);
                return;
            }
            if (password !== confirm) {
                showMessage("Konfirmasi password tidak sama.", false);
                return;
            }
            if (all[username]) {
                showMessage("Username sudah dipakai. Pilih username lain.", false);
                return;
            }

            all[username] = { name: name, password: hashPassword(password) };
            write(USERS_KEY, all);
            localStorage.setItem(SESSION_KEY, username);
            location.replace("index.html");
        });
    }

    /* ---------- Sidebar (nama user, keluar, badge) ---------- */
    function updateBadge() {
        var badge = document.getElementById("nav-badge");
        if (!badge) return;
        var urgent = getReminders().filter(function (r) { return r.diff <= 1; }).length;
        badge.textContent = urgent;
        badge.hidden = urgent === 0;
    }

    function initSidebar() {
        var nameEl = document.getElementById("user-name");
        if (!nameEl) return;

        var user = users[session];
        nameEl.textContent = user.name;
        document.getElementById("user-username").textContent = "@" + session;
        document.getElementById("user-avatar").textContent = user.name.charAt(0).toUpperCase();

        document.getElementById("logout-btn").addEventListener("click", function () {
            localStorage.removeItem(SESSION_KEY);
            location.replace("login.html");
        });

        updateBadge();
    }

    /* ---------- Dashboard ---------- */
    function initDashboard() {
        var list = document.getElementById("reminder-list");
        if (!list) return;

        var user = users[session];
        var projects = read(dataKey("projects"), []);
        var contents = read(dataKey("content"), []);
        var comms = read(dataKey("communication"), []);
        var reminders = getReminders();
        var urgent = reminders.filter(function (r) { return r.diff <= 1; });

        document.getElementById("greet-name").textContent = user.name;
        document.getElementById("today-date").textContent = new Date().toLocaleDateString("id-ID", {
            weekday: "long", day: "numeric", month: "long", year: "numeric"
        });

        // Statistik
        document.getElementById("stat-content").textContent = contents.length;
        document.getElementById("stat-projects").textContent = projects.length;
        document.getElementById("stat-active").textContent = projects.filter(function (p) {
            return p.status !== "Selesai";
        }).length;
        document.getElementById("stat-urgent").textContent = urgent.length;

        // Teks sambutan
        var welcomeText = document.getElementById("welcome-text");
        if (reminders.length === 0) {
            welcomeText.textContent = "Tidak ada deadline atau jadwal posting dalam 7 hari ke depan. Semua pekerjaan terpantau aman.";
        } else {
            welcomeText.textContent = "Ada " + reminders.length + " pengingat dalam 7 hari ke depan, " +
                urgent.length + " di antaranya perlu segera ditangani.";
        }

        // Banner peringatan
        var alertBox = document.getElementById("alert-box");
        if (urgent.length > 0) {
            var names = urgent.slice(0, 3).map(function (r) {
                return escapeHtml(r.title) + " (" + dayLabel(r.diff) + ")";
            }).join(", ");
            var more = urgent.length > 3 ? " dan " + (urgent.length - 3) + " lainnya" : "";
            alertBox.innerHTML = "<strong>Perlu perhatian:</strong> " + names + more + ".";
            alertBox.hidden = false;
        }

        // Daftar pengingat
        if (reminders.length === 0) {
            list.innerHTML = '<li class="empty-item">Belum ada pengingat. Tambahkan project atau jadwal konten agar muncul di sini.</li>';
        } else {
            list.innerHTML = reminders.slice(0, 8).map(function (r) {
                return '<li><a class="reminder ' + dayLevel(r.diff) + '" href="' + r.href + '">' +
                    '<span class="reminder-tag">' + dayLabel(r.diff) + '</span>' +
                    '<span class="reminder-body"><strong>' + escapeHtml(r.title) + '</strong>' +
                    '<small>' + escapeHtml(r.type) + ' | ' + escapeHtml(r.meta) + '</small></span></a></li>';
            }).join("");
        }

        // Progres project
        var total = projects.length;
        var done = projects.filter(function (p) { return p.status === "Selesai"; }).length;
        var running = projects.filter(function (p) { return p.status === "Proses"; }).length;
        var notStarted = projects.filter(function (p) { return p.status === "Belum Mulai"; }).length;
        var percent = total ? Math.round((done / total) * 100) : 0;

        document.getElementById("progress-fill").style.width = percent + "%";
        document.getElementById("progress-text").textContent = percent + "% project selesai";
        document.getElementById("count-belum").textContent = notStarted;
        document.getElementById("count-proses").textContent = running;
        document.getElementById("count-selesai").textContent = done;

        // Catatan terbaru
        var recent = document.getElementById("recent-comm");
        if (comms.length === 0) {
            recent.innerHTML = '<li class="empty-item">Belum ada catatan komunikasi.</li>';
        } else {
            recent.innerHTML = comms.slice(-3).reverse().map(function (c) {
                return '<li class="recent-item"><span class="badge ' + slug(c.tipe) + '">' + escapeHtml(c.tipe) + '</span>' +
                    '<strong>' + escapeHtml(c.judul) + '</strong>' +
                    '<small>Dari ' + escapeHtml(c.dari || "-") + ' | ' + (c.tanggal ? fmtDate(c.tanggal) : "-") + '</small></li>';
            }).join("");
        }
    }

    /* ---------- Form + tabel (Content, Projects, Communication) ---------- */
    function initTable() {
        var form = document.getElementById("entry-form");
        var tbody = document.getElementById("entry-body");
        if (!form || !tbody) return;

        var storageKey = dataKey(document.body.getAttribute("data-store"));
        var fields = [];
        document.querySelectorAll("#entry-table th[data-field]").forEach(function (th) {
            fields.push(th.getAttribute("data-field"));
        });

        var statusSelect = form.elements.status;
        var statusOptions = statusSelect && statusSelect.options
            ? Array.prototype.map.call(statusSelect.options, function (o) { return o.value; })
            : [];

        function render() {
            var data = read(storageKey, []);

            if (data.length === 0) {
                tbody.innerHTML = '<tr><td class="empty" colspan="' + (fields.length + 1) +
                    '">Belum ada data. Isi form di atas untuk menambahkan.</td></tr>';
                return;
            }

            var html = "";
            data.forEach(function (item, index) {
                var urgentRow = item.deadline && item.status !== "Selesai" && daysLeft(item.deadline) <= 1;
                html += "<tr" + (urgentRow ? ' class="row-urgent"' : "") + ">";

                fields.forEach(function (field) {
                    var value = item[field] || "";

                    if (field === "status" && statusOptions.length) {
                        html += '<td><select class="status-select ' + slug(value) + '" data-index="' + index + '">' +
                            statusOptions.map(function (o) {
                                return "<option" + (o === value ? " selected" : "") + ">" + escapeHtml(o) + "</option>";
                            }).join("") + "</select></td>";
                    } else if (field === "tipe") {
                        html += '<td><span class="badge ' + slug(value) + '">' + escapeHtml(value) + "</span></td>";
                    } else if (DATE_FIELDS.indexOf(field) !== -1) {
                        html += "<td>" + (value ? fmtDate(value) : "-") + "</td>";
                    } else {
                        html += "<td>" + (value ? escapeHtml(value) : "-") + "</td>";
                    }
                });

                html += '<td><button type="button" class="btn-delete" data-index="' + index + '">Hapus</button></td></tr>';
            });
            tbody.innerHTML = html;
        }

        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var item = {};
            fields.forEach(function (field) {
                var input = form.elements[field];
                item[field] = input ? input.value.trim() : "";
            });

            var data = read(storageKey, []);
            data.push(item);
            write(storageKey, data);

            form.reset();
            render();
            updateBadge();
        });

        tbody.addEventListener("click", function (event) {
            var button = event.target.closest(".btn-delete");
            if (!button) return;
            if (!confirm("Hapus data ini?")) return;

            var data = read(storageKey, []);
            data.splice(Number(button.getAttribute("data-index")), 1);
            write(storageKey, data);
            render();
            updateBadge();
        });

        tbody.addEventListener("change", function (event) {
            var select = event.target.closest(".status-select");
            if (!select) return;

            var data = read(storageKey, []);
            var index = Number(select.getAttribute("data-index"));
            if (data[index]) {
                data[index].status = select.value;
                write(storageKey, data);
            }
            render();
            updateBadge();
        });

        render();
    }

    document.addEventListener("DOMContentLoaded", function () {
        initLogin();
        initSidebar();
        initDashboard();
        initTable();
    });
})();