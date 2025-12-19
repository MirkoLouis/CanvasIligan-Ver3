drop database if exists canvasiligan_db;
create database canvasiligan_db;
use canvasiligan_db;

create table store (
	store_id int primary key auto_increment,
    store_name varchar (255),
    store_street text,
    store_barangay varchar (100),
    store_city varchar (100),
    store_contactnumber bigint,
    store_latitude decimal (20, 17),
    store_longitude decimal (20, 17),
    store_rating tinyint,
    store_image_url text,
    store_banner_url text,
    store_opening_days varchar(255),
    store_opening_time time,
    store_closing_time time
);

create table category (
	category_id int primary key auto_increment,
    category_name varchar(100)
);

create table products (
	product_id int primary key auto_increment,
    product_name varchar (255),
    product_desc1 text,
    product_desc2 text,
    product_desc3 text,
    category_id int,
    product_image_url text,
    product_embedding blob,
    
    foreign key (category_id) references category (category_id),
    index(category_id)
);

create table product_availability (
    product_id int,
    store_id int,
    price decimal(10, 2) not null,
    primary key (product_id, store_id),
    foreign key (product_id) references products(product_id),
    foreign key (store_id) references store(store_id)
);