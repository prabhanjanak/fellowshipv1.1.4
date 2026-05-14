INSERT INTO application_submissions (form_id, full_name, email, phone, specialization, center_preference, status, form_data, submitted_at, is_mock) 
VALUES 
(18, 'Test Candidate Live', 'test.live@example.com', '0000000000', '["Cornea"]', '{}', 'pending', '{}', NOW(), false), 
(18, 'Test Candidate Mock', 'test.mock@example.com', '1111111111', '["Retina"]', '{}', 'pending', '{}', NOW(), true);
