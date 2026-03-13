upstream django {
    # fail_timeout=0 means we always retry an upstream even if it failed
    # to return a good HTTP response

    # for UNIX domain socket setups
    # server unix:/tmp/gunicorn.sock fail_timeout=0;

    # for a TCP configuration
    server 127.0.0.1:9000 fail_timeout=0;
}


server {

    listen 80;
    listen 443 ssl;
    listen [::]:443 ssl;

    server_name www.bordercore.com;

    location /.well-known/acme-challenge {
        root /usr/share/nginx/html/letsencrypt;
    }

    location /favicon.ico {
        root /var/www/html;
    }

    location /static {
        root /var/www/django;
        add_header Cache-Control "public, max-age=31536000";
    }

    location /favicons {

        proxy_pass https://bordercore-blobs.s3.amazonaws.com/django/img/favicons;
        proxy_set_header Host bordercore-blobs.s3.amazonaws.com;
        proxy_intercept_errors on;
        proxy_redirect off;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        error_page 403 =200 /favicons/default.png;

        location /favicons/default.png {
            internal;
            root /var/www/html;
        }

    }

    location / {

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # we don't want nginx trying to do something clever with
        # redirects, we set the Host: header above already.
        proxy_redirect off;

        # Disable buffering for streaming HTTP responses
        proxy_buffering off;

        proxy_pass http://django;

    }

    access_log /var/log/django/access.log main;
    error_log /var/log/django/error.log;

    # git support
    location ~ ^/git(/.*) {

        auth_basic "Git Repos";
        auth_basic_user_file "/etc/nginx/htpasswd-git";

        fastcgi_pass  localhost:9002;

        error_log     /var/log/nginx/giterror.log;
        include      fastcgi_params;

        fastcgi_param SCRIPT_FILENAME     /usr/lib/git-core/git-http-backend;

        # export all repositories under GIT_PROJECT_ROOT
        fastcgi_param GIT_HTTP_EXPORT_ALL "";
        fastcgi_param REMOTE_USER $remote_user;
        fastcgi_param GIT_PROJECT_ROOT    /home/git;
        fastcgi_param PATH_INFO           $1;

    }

    ssl_certificate /etc/letsencrypt/live/www.bordercore.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.bordercore.com/privkey.pem;
}

# Proxy cover images. We do this so that we can return a
#  default image if one is missing from S3.
server {

    listen 443 ssl;
    listen [::]:443 ssl;

    server_name blobs.bordercore.com;

    # S3 proxy cache settings (shared across all locations)
    proxy_cache s3_images;
    proxy_cache_valid 200 30d;
    proxy_cache_valid 403 1m;
    proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
    proxy_cache_lock on;
    add_header X-Cache-Status $upstream_cache_status;

    location / {

        proxy_pass https://bordercore-blobs.s3.amazonaws.com/;
        proxy_set_header Host bordercore-blobs.s3.amazonaws.com;
        proxy_intercept_errors on;
        proxy_redirect off;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # Don't serve back a default image if "nodefault=1" is passed in
        if ($args !~ nodefault=1) {
            error_page 403 =200 /default-cover.png;
        }

        location /default-cover.png {
            internal;
            root /var/www/html;
        }

    }

    location /collections/ {

        proxy_pass https://bordercore-blobs.s3.amazonaws.com/collections/;
        proxy_set_header Host bordercore-blobs.s3.amazonaws.com;
        proxy_intercept_errors on;
        proxy_redirect off;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        error_page 403 =200 /default-cover.png;

        location /collections/default-cover.png {
            internal;
            root /var/www/html;
        }

    }

    location /bookmarks/ {

        proxy_pass https://bordercore-blobs.s3.amazonaws.com/bookmarks/;
        proxy_set_header Host bordercore-blobs.s3.amazonaws.com;
        proxy_intercept_errors on;
        proxy_redirect off;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        error_page 403 =200 /default-cover.png;

        location /bookmarks/default-cover.png {
            internal;
            root /var/www/html;
        }

    }

    ssl_certificate /etc/letsencrypt/live/www.bordercore.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.bordercore.com/privkey.pem;
}

# Proxy album artwork images. We do this so that we can return a
#  default image if one is missing from S3.
server {

    listen 443 ssl;
    listen [::]:443 ssl;

    server_name images.bordercore.com;

    # S3 proxy cache settings
    proxy_cache s3_images;
    proxy_cache_valid 200 30d;
    proxy_cache_valid 403 1m;
    proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
    proxy_cache_lock on;
    add_header X-Cache-Status $upstream_cache_status;

    location /album_artwork/ {

        proxy_pass https://bordercore-music.s3.amazonaws.com/album_artwork/;
        proxy_set_header Host bordercore-music.s3.amazonaws.com;
        proxy_intercept_errors on;
        proxy_redirect off;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        error_page 403 =200 /album_artwork/artwork/default-album-artwork.jpg;

        location /album_artwork/artwork/default-album-artwork.jpg {
            internal;
            root /var/www/html;
        }

    }

    location /artist_images/ {

        proxy_pass https://bordercore-music.s3.amazonaws.com/artist_images/;
        proxy_set_header Host bordercore-music.s3.amazonaws.com;
        proxy_intercept_errors on;
        proxy_redirect off;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        error_page 403 =200 /artist_images/default-artist-image.jpg;

        location /artist_images/default-artist-image.jpg {
            internal;
            root /var/www/html;
        }

    }

    ssl_certificate /etc/letsencrypt/live/www.bordercore.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.bordercore.com/privkey.pem;
}
