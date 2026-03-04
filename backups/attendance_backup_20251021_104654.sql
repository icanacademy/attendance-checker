PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_name TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, late_reason TEXT, absent_reason TEXT,
      UNIQUE(teacher_id, date)
    );
INSERT INTO attendance VALUES(165,'[Ashley] Princess Lovelyn Ashley Aspera','288d37d6-6630-80de-ba4f-d168126460e3','2025-10-20','present','8am','5pm','2025-10-20 03:07:17',NULL,NULL);
INSERT INTO attendance VALUES(166,'[Ceige] Christine Joy Malihan','1abd37d6-6630-8028-98a6-d0100e6226ce','2025-10-20','absent','8am','7pm','2025-10-20 04:57:09',NULL,'Official vacation leave');
INSERT INTO attendance VALUES(167,'[Cha] Charlene Ricohermoso','1abd37d6-6630-80c9-9fa4-de55251407a8','2025-10-20','present','8am','5pm','2025-10-20 03:07:25',NULL,NULL);
INSERT INTO attendance VALUES(168,'[Chester] Chester Kent Guban','1abd37d6-6630-8064-b445-f65d60651e01','2025-10-20','present','8am','12pm','2025-10-20 03:07:26',NULL,NULL);
INSERT INTO attendance VALUES(169,'[Chrystal] Chrystal De Jesus','1abd37d6-6630-806a-89fb-eab0637cc687','2025-10-20','present','8am','5pm','2025-10-20 03:07:27',NULL,NULL);
INSERT INTO attendance VALUES(170,'[Deena] Deena Waquiz','1abd37d6-6630-808b-87ba-ce05e5649a31','2025-10-20','present','8am','9pm','2025-10-20 03:07:48',NULL,NULL);
INSERT INTO attendance VALUES(171,'[Delene] Mylene Bilon','1abd37d6-6630-80d7-83f9-f22d0c2b2e4f','2025-10-20','present','8am','5pm','2025-10-20 03:07:49',NULL,NULL);
INSERT INTO attendance VALUES(172,'[Demple] Demple Agan','1abd37d6-6630-8074-8724-c44883e21eb5','2025-10-20','present','8am','5pm','2025-10-20 03:07:49',NULL,NULL);
INSERT INTO attendance VALUES(173,'[Eunice] Eunice Joy Meman','1abd37d6-6630-8069-ac50-cba27c2832ec','2025-10-20','present','8am','5pm','2025-10-20 03:07:51',NULL,NULL);
INSERT INTO attendance VALUES(174,'[Iann] Mooteia Ianna Marino','1abd37d6-6630-8071-a25d-fc934e9d7e48','2025-10-20','present','8am','5pm','2025-10-20 03:07:53',NULL,NULL);
INSERT INTO attendance VALUES(175,'[Janine] Janine Musa Quinisio','28cd37d6-6630-80b5-b3a1-d851c53d909a','2025-10-20','present','8am','5pm','2025-10-20 03:07:54',NULL,NULL);
INSERT INTO attendance VALUES(176,'[Jessica] Jessica Unabia','21fd37d6-6630-8039-8266-c7ad5c3a7525','2025-10-20','present','8am','5pm','2025-10-20 03:07:54',NULL,NULL);
INSERT INTO attendance VALUES(177,'[Joyce] Mary Joyce Espiritu','21cd37d6-6630-808c-8ff7-dd959d127c2f','2025-10-20','late','8am','5pm','2025-10-20 04:58:11','Traffic/Transportation delay',NULL);
INSERT INTO attendance VALUES(178,'[June] Alfredo Nicolas Alunday Jr.','1abd37d6-6630-8050-adef-c5f097993df9','2025-10-20','late','8am','5pm','2025-10-20 05:06:02','Traffic/Transportation delay',NULL);
INSERT INTO attendance VALUES(179,'[Leah] Leah Crystaline Hipos','1abd37d6-6630-803d-bde5-caba4b047b7c','2025-10-20','present','8am','12pm','2025-10-20 03:07:57',NULL,NULL);
INSERT INTO attendance VALUES(180,'[Lian] Lianah Establecida','1abd37d6-6630-80b9-bc6e-e7aee53ccd95','2025-10-20','present','8am','12pm','2025-10-20 03:08:00',NULL,NULL);
INSERT INTO attendance VALUES(181,'[Luis] Angelo Luis Alonzo','236d37d6-6630-80e5-95b4-fc4e09ed7fdb','2025-10-20','late','8am','12pm','2025-10-20 04:58:28','Traffic/Transportation delay',NULL);
INSERT INTO attendance VALUES(182,'[Mari] Maricris Recalde','1abd37d6-6630-801a-9cd4-dcea792224ad','2025-10-20','present','8am','5pm','2025-10-20 03:08:01',NULL,NULL);
INSERT INTO attendance VALUES(183,'[Mikay] Nympha Pleños','1abd37d6-6630-807e-a85b-f2b460bfef95','2025-10-20','present','8am','5pm','2025-10-20 03:08:02',NULL,NULL);
INSERT INTO attendance VALUES(184,'[Minmin] Jasmin Ajo','1abd37d6-6630-80d2-81e1-ded2695ff510','2025-10-20','present','8am','5pm','2025-10-20 03:08:05',NULL,NULL);
INSERT INTO attendance VALUES(185,'[Rose] Rose Ann Colinares','1abd37d6-6630-804a-bd8b-d5ac6094d21d','2025-10-20','absent','8am','12pm','2025-10-20 03:09:33',NULL,'Official sick leave');
INSERT INTO attendance VALUES(188,'[Edward] John Edward Padilla','1abd37d6-6630-80f5-aa09-f0cc4419cae5','2025-10-20','present','10am','7pm','2025-10-20 03:09:39',NULL,NULL);
INSERT INTO attendance VALUES(189,'[Frenz] Frenzy Rose Calayeg','1abd37d6-6630-801b-bacd-d17da8abdcb6','2025-10-20','present','10am','7pm','2025-10-20 03:09:39',NULL,NULL);
INSERT INTO attendance VALUES(190,'[Noel] Noel Delos Reyes','1abd37d6-6630-80ac-83aa-fe2c869b0916','2025-10-20','present','10am','9pm','2025-10-20 03:09:40',NULL,NULL);
INSERT INTO attendance VALUES(196,'[Ada] Rhodalyn Ferrer','217d37d6-6630-802a-93c0-dfadc8f2f931','2025-10-20','late','8am','12pm','2025-10-20 04:52:42','Traffic/Transportation delay',NULL);
INSERT INTO attendance VALUES(206,'[Analyn] Analyn Roa','1abd37d6-6630-80b6-b9c7-d4cd2377d536','2025-10-20','present','1pm','9pm','2025-10-20 04:58:36',NULL,NULL);
INSERT INTO attendance VALUES(207,'[Argel] Argel Joseph Sotto','1abd37d6-6630-8027-862e-dc17100ae1c3','2025-10-20','present','1pm','9pm','2025-10-20 04:58:37',NULL,NULL);
INSERT INTO attendance VALUES(208,'[Ezra] Ezra Joseph Saracho','1abd37d6-6630-8073-9bca-f9adbba94b94','2025-10-20','present','1pm','9pm','2025-10-20 04:58:39',NULL,NULL);
INSERT INTO attendance VALUES(209,'[Faye] Faye Ruby Ann Ladiza','1abd37d6-6630-806e-96c5-f57b78a52fee','2025-10-20','present','1pm','9pm','2025-10-20 04:58:40',NULL,NULL);
INSERT INTO attendance VALUES(210,'[Janice] Janice Fernandez','1abd37d6-6630-803b-966a-ed9d7ec6bce8','2025-10-20','absent','1pm','9pm','2025-10-20 05:01:53',NULL,'Sick/Medical');
INSERT INTO attendance VALUES(211,'[Raf] Rafael Vincent Canlas','1abd37d6-6630-8008-9119-e580f9aa50e8','2025-10-20','present','1pm','7pm','2025-10-20 05:01:56',NULL,NULL);
INSERT INTO attendance VALUES(212,'[Paula] Ma. Jalyn De Galicia','1abd37d6-6630-8029-b7ff-e04c05be1115','2025-10-20','present','1pm','9pm','2025-10-20 05:01:57',NULL,NULL);
INSERT INTO attendance VALUES(213,'[Melody] Melody Joy Mata','1abd37d6-6630-80d5-9705-c88845985edb','2025-10-20','present','1pm','9pm','2025-10-20 05:01:58',NULL,NULL);
INSERT INTO attendance VALUES(214,'[Marc] Marc Noel Dela Cruz','22ad37d6-6630-8082-a3f2-e4605ee0f9f4','2025-10-20','present','1pm','5pm','2025-10-20 05:01:59',NULL,NULL);
INSERT INTO attendance VALUES(215,'[Karen] Karen Gordon','1abd37d6-6630-80ca-b1c5-c3ce213cfa84','2025-10-20','present','1pm','9pm','2025-10-20 05:02:01',NULL,NULL);
INSERT INTO attendance VALUES(217,'[Justine] Justine Roi Magpayo','236d37d6-6630-8076-ad4f-dddcda539c0d','2025-10-20','present','3pm','7pm','2025-10-20 07:06:59',NULL,NULL);
INSERT INTO attendance VALUES(218,'[Demple] Demple Agan','1abd37d6-6630-8074-8724-c44883e21eb5','2025-10-21','present','8am','5pm','2025-10-20 23:31:48',NULL,NULL);
INSERT INTO attendance VALUES(219,'[Iann] Mooteia Ianna Marino','1abd37d6-6630-8071-a25d-fc934e9d7e48','2025-10-21','present','8am','5pm','2025-10-20 23:31:53',NULL,NULL);
INSERT INTO attendance VALUES(220,'[June] Alfredo Nicolas Alunday Jr.','1abd37d6-6630-8050-adef-c5f097993df9','2025-10-21','present','8am','5pm','2025-10-20 23:31:57',NULL,NULL);
INSERT INTO attendance VALUES(221,'[Leah] Leah Crystaline Hipos','1abd37d6-6630-803d-bde5-caba4b047b7c','2025-10-21','present','8am','12pm','2025-10-20 23:32:00',NULL,NULL);
INSERT INTO attendance VALUES(222,'[Lian] Lianah Establecida','1abd37d6-6630-80b9-bc6e-e7aee53ccd95','2025-10-21','present','8am','12pm','2025-10-20 23:32:02',NULL,NULL);
INSERT INTO attendance VALUES(223,'[Mikay] Nympha Pleños','1abd37d6-6630-807e-a85b-f2b460bfef95','2025-10-21','present','8am','5pm','2025-10-20 23:32:06',NULL,NULL);
INSERT INTO attendance VALUES(224,'[Ashley] Princess Lovelyn Ashley Aspera','288d37d6-6630-80de-ba4f-d168126460e3','2025-10-21','present','8am','5pm','2025-10-20 23:35:27',NULL,NULL);
INSERT INTO attendance VALUES(225,'[Jessica] Jessica Unabia','21fd37d6-6630-8039-8266-c7ad5c3a7525','2025-10-21','present','8am','5pm','2025-10-20 23:35:33',NULL,NULL);
INSERT INTO attendance VALUES(226,'[Janine] Janine Musa Quinisio','28cd37d6-6630-80b5-b3a1-d851c53d909a','2025-10-21','present','8am','5pm','2025-10-20 23:35:34',NULL,NULL);
INSERT INTO attendance VALUES(227,'[Rose] Rose Ann Colinares','1abd37d6-6630-804a-bd8b-d5ac6094d21d','2025-10-21','present','8am','12pm','2025-10-20 23:35:37',NULL,NULL);
INSERT INTO attendance VALUES(228,'[Minmin] Jasmin Ajo','1abd37d6-6630-80d2-81e1-ded2695ff510','2025-10-21','present','8am','5pm','2025-10-20 23:35:40',NULL,NULL);
INSERT INTO attendance VALUES(229,'[Ceige] Christine Joy Malihan','1abd37d6-6630-8028-98a6-d0100e6226ce','2025-10-21','absent','8am','7pm','2025-10-20 23:36:28',NULL,'Official vacation leave');
INSERT INTO attendance VALUES(230,'[Delene] Mylene Bilon','1abd37d6-6630-80d7-83f9-f22d0c2b2e4f','2025-10-21','present','8am','5pm','2025-10-20 23:36:59',NULL,NULL);
INSERT INTO attendance VALUES(231,'[Eunice] Eunice Joy Meman','1abd37d6-6630-8069-ac50-cba27c2832ec','2025-10-21','present','8am','5pm','2025-10-20 23:48:27',NULL,NULL);
INSERT INTO attendance VALUES(232,'[Joyce] Mary Joyce Espiritu','21cd37d6-6630-808c-8ff7-dd959d127c2f','2025-10-21','present','8am','5pm','2025-10-20 23:48:33',NULL,NULL);
INSERT INTO attendance VALUES(233,'[Luis] Angelo Luis Alonzo','236d37d6-6630-80e5-95b4-fc4e09ed7fdb','2025-10-21','present','8am','12pm','2025-10-20 23:48:43',NULL,NULL);
INSERT INTO attendance VALUES(234,'[Deena] Deena Waquiz','1abd37d6-6630-808b-87ba-ce05e5649a31','2025-10-21','present','8am','9pm','2025-10-20 23:53:14',NULL,NULL);
INSERT INTO attendance VALUES(235,'[Cha] Charlene Ricohermoso','1abd37d6-6630-80c9-9fa4-de55251407a8','2025-10-21','present','8am','5pm','2025-10-20 23:54:43',NULL,NULL);
INSERT INTO attendance VALUES(236,'[Ada] Rhodalyn Ferrer','217d37d6-6630-802a-93c0-dfadc8f2f931','2025-10-21','late','8am','12pm','2025-10-20 23:55:25','Traffic/Transportation delay',NULL);
INSERT INTO attendance VALUES(237,'[Chester] Chester Kent Guban','1abd37d6-6630-8064-b445-f65d60651e01','2025-10-21','late','8am','12pm','2025-10-20 23:55:34','Traffic/Transportation delay',NULL);
INSERT INTO attendance VALUES(238,'[Mari] Maricris Recalde','1abd37d6-6630-801a-9cd4-dcea792224ad','2025-10-21','late','8am','5pm','2025-10-20 23:55:50','Traffic/Transportation delay',NULL);
INSERT INTO attendance VALUES(239,'[Chrystal] Chrystal De Jesus','1abd37d6-6630-806a-89fb-eab0637cc687','2025-10-21','present','8am','5pm','2025-10-21 02:37:10',NULL,NULL);
INSERT INTO attendance VALUES(240,'[Edward] John Edward Padilla','1abd37d6-6630-80f5-aa09-f0cc4419cae5','2025-10-21','present','10am','7pm','2025-10-21 02:37:18',NULL,NULL);
INSERT INTO attendance VALUES(241,'[Frenz] Frenzy Rose Calayeg','1abd37d6-6630-801b-bacd-d17da8abdcb6','2025-10-21','present','10am','7pm','2025-10-21 02:37:20',NULL,NULL);
INSERT INTO attendance VALUES(242,'[Noel] Noel Delos Reyes','1abd37d6-6630-80ac-83aa-fe2c869b0916','2025-10-21','present','10am','9pm','2025-10-21 02:37:21',NULL,NULL);
CREATE TABLE class_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attendance_id INTEGER NOT NULL,
      class_slot TEXT NOT NULL,
      substitute_teacher_id TEXT,
      substitute_teacher_name TEXT,
      students TEXT, no_class INTEGER DEFAULT 0, online_class INTEGER DEFAULT 0,
      FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE
    );
INSERT INTO class_assignments VALUES(54,185,'8am - 10am','1abd37d6-6630-806a-89fb-eab0637cc687','[Chrystal] Chrystal De Jesus','[{"id":"27dd37d6-6630-80a5-8498-c0d9fb684422","name":"Kim Ye Seo 김예서"}]',0,0);
INSERT INTO class_assignments VALUES(55,185,'10am - 12pm','1abd37d6-6630-8050-adef-c5f097993df9','[June] Alfredo Nicolas Alunday Jr.','[{"id":"231d37d6-6630-804c-9121-e03ec057918a","name":"Kim Ji Yong [김지용]"}]',0,0);
INSERT INTO class_assignments VALUES(56,196,'8am - 10am',NULL,NULL,'[]',1,0);
INSERT INTO class_assignments VALUES(57,196,'10am - 12pm',NULL,NULL,'[]',0,1);
INSERT INTO class_assignments VALUES(58,166,'8am - 10am','217d37d6-6630-802a-93c0-dfadc8f2f931','[Ada] Rhodalyn Ferrer','[{"id":"27dd37d6-6630-807d-9a99-d78668b9e718","name":"Lee Ji An 이지안"}]',0,0);
INSERT INTO class_assignments VALUES(59,166,'10am - 12pm','217d37d6-6630-802a-93c0-dfadc8f2f931','[Ada] Rhodalyn Ferrer','[{"id":"27dd37d6-6630-8098-8f3b-ee74870740c3","name":"Lee Seo Eun 이서은"}]',0,0);
INSERT INTO class_assignments VALUES(60,166,'1pm - 3pm','1abd37d6-6630-801b-bacd-d17da8abdcb6','[Frenz] Frenzy Rose Calayeg','[{"id":"27dd37d6-6630-80a5-8498-c0d9fb684422","name":"Kim Ye Seo 김예서"}]',0,0);
INSERT INTO class_assignments VALUES(61,166,'3pm - 5pm','1abd37d6-6630-80d7-83f9-f22d0c2b2e4f','[Delene] Mylene Bilon','[{"id":"231d37d6-6630-804c-9121-e03ec057918a","name":"Kim Ji Yong [김지용]"}]',0,0);
INSERT INTO class_assignments VALUES(62,166,'5pm - 7pm',NULL,NULL,'[]',0,1);
INSERT INTO class_assignments VALUES(63,210,'1pm - 3pm','1abd37d6-6630-8074-8724-c44883e21eb5','[Demple] Demple Agan','[{"id":"22dd37d6-6630-80bf-ac95-d50664b89cf0","name":"Lee Ha El [이하엘]"}]',0,0);
INSERT INTO class_assignments VALUES(64,210,'3pm - 5pm','288d37d6-6630-80de-ba4f-d168126460e3','[Ashley] Princess Lovelyn Ashley Aspera','[{"id":"27dd37d6-6630-8098-8f3b-ee74870740c3","name":"Lee Seo Eun 이서은"}]',0,0);
INSERT INTO class_assignments VALUES(65,210,'5pm - 7pm',NULL,NULL,'[]',0,1);
INSERT INTO class_assignments VALUES(66,210,'7pm - 9pm',NULL,NULL,'[]',0,1);
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('attendance',242);
INSERT INTO sqlite_sequence VALUES('class_assignments',66);
COMMIT;
