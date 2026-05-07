--
-- PostgreSQL database dump
--

\restrict nlRsVSMwcMvnOJyZHy2MBg4Ywyl0HbcsRgR512bEFYB5wsNHjP1NNNo4AvXKTGK

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: candidate_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.candidate_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'interview_completed',
    'waitlisted',
    'allocated'
);


ALTER TYPE public.candidate_status OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'super_admin',
    'program_admin',
    'exam_coordinator',
    'central_exam_coordinator',
    'unit_coordinator',
    'doctor',
    'student',
    'display_operator'
);


ALTER TYPE public.user_role OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: allocations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.allocations (
    id integer NOT NULL,
    candidate_id integer NOT NULL,
    program_id integer NOT NULL,
    speciality_id integer,
    unit_id integer,
    status text DEFAULT 'SELECTED'::text NOT NULL,
    rank integer,
    total_score real,
    allocated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.allocations OWNER TO postgres;

--
-- Name: allocations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.allocations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.allocations_id_seq OWNER TO postgres;

--
-- Name: allocations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.allocations_id_seq OWNED BY public.allocations.id;


--
-- Name: application_forms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.application_forms (
    id integer NOT NULL,
    token text NOT NULL,
    program_id integer NOT NULL,
    title text NOT NULL,
    description text,
    deadline timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    custom_fields jsonb DEFAULT '[]'::jsonb,
    google_forms_config jsonb DEFAULT 'null'::jsonb,
    sections_config jsonb DEFAULT '[]'::jsonb,
    payment_setting_id integer
);


ALTER TABLE public.application_forms OWNER TO postgres;

--
-- Name: application_forms_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.application_forms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.application_forms_id_seq OWNER TO postgres;

--
-- Name: application_forms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.application_forms_id_seq OWNED BY public.application_forms.id;


--
-- Name: application_submissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.application_submissions (
    id integer NOT NULL,
    application_id uuid DEFAULT gen_random_uuid(),
    form_id integer NOT NULL,
    save_as_draft boolean DEFAULT false NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    specialization text,
    center_preference text,
    referral_source text,
    referred_by_name text,
    media_source text,
    full_name text NOT NULL,
    permanent_address text,
    mailing_address text,
    phone text,
    email text NOT NULL,
    date_of_birth text,
    marital_status text,
    spouse_details text,
    health_declaration text,
    health_details text,
    medical_conditions text,
    previous_application_month_year text,
    degree text,
    medical_college text,
    university text,
    pg_qualifications text,
    do_qualification boolean,
    do_details text,
    ms_md_qualification boolean,
    ms_md_details text,
    dnb_qualification boolean,
    dnb_details text,
    other_training text,
    medical_council_number text,
    diagnostic_skills text,
    surgical_experience text,
    total_surgeries text,
    publications text,
    presentations text,
    lor1_url text,
    lor1_ref_name text,
    lor1_ref_contact text,
    lor1_ref_email text,
    lor2_url text,
    lor2_ref_name text,
    lor2_ref_contact text,
    lor2_ref_email text,
    other_information text,
    declaration_accepted boolean,
    payment_url text,
    photo_url text,
    custom_answers jsonb DEFAULT '{}'::jsonb,
    source text DEFAULT 'internal'::text NOT NULL,
    ready_for_review boolean DEFAULT false NOT NULL,
    google_forms_response_id text,
    review_notes text,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    qualification_matrix text
);


ALTER TABLE public.application_submissions OWNER TO postgres;

--
-- Name: application_submissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.application_submissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.application_submissions_id_seq OWNER TO postgres;

--
-- Name: application_submissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.application_submissions_id_seq OWNED BY public.application_submissions.id;


--
-- Name: candidate_exam_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_exam_assignments (
    id integer NOT NULL,
    candidate_id integer NOT NULL,
    exam_id integer NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.candidate_exam_assignments OWNER TO postgres;

--
-- Name: candidate_exam_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.candidate_exam_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.candidate_exam_assignments_id_seq OWNER TO postgres;

--
-- Name: candidate_exam_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.candidate_exam_assignments_id_seq OWNED BY public.candidate_exam_assignments.id;


--
-- Name: candidate_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_preferences (
    id integer NOT NULL,
    candidate_id integer NOT NULL,
    speciality_id integer NOT NULL,
    preference_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.candidate_preferences OWNER TO postgres;

--
-- Name: candidate_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.candidate_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.candidate_preferences_id_seq OWNER TO postgres;

--
-- Name: candidate_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.candidate_preferences_id_seq OWNED BY public.candidate_preferences.id;


--
-- Name: candidates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidates (
    id integer NOT NULL,
    user_id integer,
    candidate_code text NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text,
    date_of_birth text,
    gender text,
    qualification text,
    college_name text,
    address text,
    unit_id integer,
    status public.candidate_status DEFAULT 'pending'::public.candidate_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.candidates OWNER TO postgres;

--
-- Name: candidates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.candidates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.candidates_id_seq OWNER TO postgres;

--
-- Name: candidates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.candidates_id_seq OWNED BY public.candidates.id;


--
-- Name: doctor_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.doctor_assignments (
    id integer NOT NULL,
    doctor_id integer NOT NULL,
    candidate_id integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    scheduled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.doctor_assignments OWNER TO postgres;

--
-- Name: doctor_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.doctor_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.doctor_assignments_id_seq OWNER TO postgres;

--
-- Name: doctor_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.doctor_assignments_id_seq OWNED BY public.doctor_assignments.id;


--
-- Name: documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documents (
    id integer NOT NULL,
    candidate_id integer NOT NULL,
    doc_type text NOT NULL,
    file_name text NOT NULL,
    file_url text,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.documents_id_seq OWNER TO postgres;

--
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- Name: exam_answers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exam_answers (
    id integer NOT NULL,
    attempt_id integer NOT NULL,
    question_id integer NOT NULL,
    selected_index integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.exam_answers OWNER TO postgres;

--
-- Name: exam_answers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.exam_answers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exam_answers_id_seq OWNER TO postgres;

--
-- Name: exam_answers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.exam_answers_id_seq OWNED BY public.exam_answers.id;


--
-- Name: exam_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exam_attempts (
    id integer NOT NULL,
    candidate_id integer NOT NULL,
    exam_id integer NOT NULL,
    score real,
    max_score real,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    submitted_at timestamp with time zone
);


ALTER TABLE public.exam_attempts OWNER TO postgres;

--
-- Name: exam_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.exam_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exam_attempts_id_seq OWNER TO postgres;

--
-- Name: exam_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.exam_attempts_id_seq OWNED BY public.exam_attempts.id;


--
-- Name: exams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exams (
    id integer NOT NULL,
    title text NOT NULL,
    kind text NOT NULL,
    program_id integer,
    duration_minutes integer DEFAULT 60 NOT NULL,
    total_questions integer DEFAULT 20 NOT NULL,
    passing_score real,
    description text,
    active boolean DEFAULT true NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.exams OWNER TO postgres;

--
-- Name: exams_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.exams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exams_id_seq OWNER TO postgres;

--
-- Name: exams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.exams_id_seq OWNED BY public.exams.id;


--
-- Name: interview_panel_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.interview_panel_members (
    id integer NOT NULL,
    panel_id integer NOT NULL,
    doctor_id integer NOT NULL,
    is_main boolean DEFAULT false NOT NULL
);


ALTER TABLE public.interview_panel_members OWNER TO postgres;

--
-- Name: interview_panel_members_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.interview_panel_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.interview_panel_members_id_seq OWNER TO postgres;

--
-- Name: interview_panel_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.interview_panel_members_id_seq OWNED BY public.interview_panel_members.id;


--
-- Name: interview_panels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.interview_panels (
    id integer NOT NULL,
    name text NOT NULL,
    room_number text NOT NULL,
    program_id integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.interview_panels OWNER TO postgres;

--
-- Name: interview_panels_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.interview_panels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.interview_panels_id_seq OWNER TO postgres;

--
-- Name: interview_panels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.interview_panels_id_seq OWNED BY public.interview_panels.id;


--
-- Name: interview_scores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.interview_scores (
    id integer NOT NULL,
    candidate_id integer NOT NULL,
    doctor_id integer NOT NULL,
    score real NOT NULL,
    remarks text,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.interview_scores OWNER TO postgres;

--
-- Name: interview_scores_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.interview_scores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.interview_scores_id_seq OWNER TO postgres;

--
-- Name: interview_scores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.interview_scores_id_seq OWNED BY public.interview_scores.id;


--
-- Name: panel_queue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.panel_queue (
    id integer NOT NULL,
    panel_id integer NOT NULL,
    candidate_id integer NOT NULL,
    queue_position integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'waiting'::text NOT NULL,
    called_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.panel_queue OWNER TO postgres;

--
-- Name: panel_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.panel_queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.panel_queue_id_seq OWNER TO postgres;

--
-- Name: panel_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.panel_queue_id_seq OWNED BY public.panel_queue.id;


--
-- Name: payment_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_settings (
    id integer NOT NULL,
    program_id integer,
    razorpay_key_id text,
    razorpay_key_secret text,
    amount integer DEFAULT 275000 NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    description text DEFAULT 'Fellowship Application Fee'::text NOT NULL,
    mode text DEFAULT 'test'::text NOT NULL,
    upi_id text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payment_settings OWNER TO postgres;

--
-- Name: payment_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_settings_id_seq OWNER TO postgres;

--
-- Name: payment_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_settings_id_seq OWNED BY public.payment_settings.id;


--
-- Name: programs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.programs (
    id integer NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    academic_year text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.programs OWNER TO postgres;

--
-- Name: programs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.programs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.programs_id_seq OWNER TO postgres;

--
-- Name: programs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.programs_id_seq OWNED BY public.programs.id;


--
-- Name: questions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.questions (
    id integer NOT NULL,
    exam_id integer NOT NULL,
    text text NOT NULL,
    choices text[] NOT NULL,
    correct_index integer NOT NULL,
    explanation text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.questions OWNER TO postgres;

--
-- Name: questions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.questions_id_seq OWNER TO postgres;

--
-- Name: questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.questions_id_seq OWNED BY public.questions.id;


--
-- Name: seat_matrix_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.seat_matrix_entries (
    id integer NOT NULL,
    program_id integer,
    speciality text NOT NULL,
    unit_name text NOT NULL,
    total_seats integer DEFAULT 0 NOT NULL,
    allocated_seats integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.seat_matrix_entries OWNER TO postgres;

--
-- Name: seat_matrix_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.seat_matrix_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.seat_matrix_entries_id_seq OWNER TO postgres;

--
-- Name: seat_matrix_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.seat_matrix_entries_id_seq OWNED BY public.seat_matrix_entries.id;


--
-- Name: specialities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.specialities (
    id integer NOT NULL,
    program_id integer NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    seats integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.specialities OWNER TO postgres;

--
-- Name: specialities_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.specialities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.specialities_id_seq OWNER TO postgres;

--
-- Name: specialities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.specialities_id_seq OWNED BY public.specialities.id;


--
-- Name: units; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.units (
    id integer NOT NULL,
    name text NOT NULL,
    city text,
    location text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.units OWNER TO postgres;

--
-- Name: units_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.units_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.units_id_seq OWNER TO postgres;

--
-- Name: units_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.units_id_seq OWNED BY public.units.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    salutation text,
    full_name text NOT NULL,
    employee_id text,
    designation text,
    gender text,
    avatar_seed text,
    role public.user_role DEFAULT 'student'::public.user_role NOT NULL,
    unit_id integer,
    program_id integer,
    active boolean DEFAULT true NOT NULL,
    force_password_reset boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: allocations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocations ALTER COLUMN id SET DEFAULT nextval('public.allocations_id_seq'::regclass);


--
-- Name: application_forms id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_forms ALTER COLUMN id SET DEFAULT nextval('public.application_forms_id_seq'::regclass);


--
-- Name: application_submissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_submissions ALTER COLUMN id SET DEFAULT nextval('public.application_submissions_id_seq'::regclass);


--
-- Name: candidate_exam_assignments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_exam_assignments ALTER COLUMN id SET DEFAULT nextval('public.candidate_exam_assignments_id_seq'::regclass);


--
-- Name: candidate_preferences id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_preferences ALTER COLUMN id SET DEFAULT nextval('public.candidate_preferences_id_seq'::regclass);


--
-- Name: candidates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidates ALTER COLUMN id SET DEFAULT nextval('public.candidates_id_seq'::regclass);


--
-- Name: doctor_assignments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_assignments ALTER COLUMN id SET DEFAULT nextval('public.doctor_assignments_id_seq'::regclass);


--
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- Name: exam_answers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_answers ALTER COLUMN id SET DEFAULT nextval('public.exam_answers_id_seq'::regclass);


--
-- Name: exam_attempts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_attempts ALTER COLUMN id SET DEFAULT nextval('public.exam_attempts_id_seq'::regclass);


--
-- Name: exams id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams ALTER COLUMN id SET DEFAULT nextval('public.exams_id_seq'::regclass);


--
-- Name: interview_panel_members id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_panel_members ALTER COLUMN id SET DEFAULT nextval('public.interview_panel_members_id_seq'::regclass);


--
-- Name: interview_panels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_panels ALTER COLUMN id SET DEFAULT nextval('public.interview_panels_id_seq'::regclass);


--
-- Name: interview_scores id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_scores ALTER COLUMN id SET DEFAULT nextval('public.interview_scores_id_seq'::regclass);


--
-- Name: panel_queue id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.panel_queue ALTER COLUMN id SET DEFAULT nextval('public.panel_queue_id_seq'::regclass);


--
-- Name: payment_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_settings ALTER COLUMN id SET DEFAULT nextval('public.payment_settings_id_seq'::regclass);


--
-- Name: programs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.programs ALTER COLUMN id SET DEFAULT nextval('public.programs_id_seq'::regclass);


--
-- Name: questions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.questions ALTER COLUMN id SET DEFAULT nextval('public.questions_id_seq'::regclass);


--
-- Name: seat_matrix_entries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seat_matrix_entries ALTER COLUMN id SET DEFAULT nextval('public.seat_matrix_entries_id_seq'::regclass);


--
-- Name: specialities id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.specialities ALTER COLUMN id SET DEFAULT nextval('public.specialities_id_seq'::regclass);


--
-- Name: units id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units ALTER COLUMN id SET DEFAULT nextval('public.units_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: allocations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.allocations (id, candidate_id, program_id, speciality_id, unit_id, status, rank, total_score, allocated_at) FROM stdin;
\.


--
-- Data for Name: application_forms; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.application_forms (id, token, program_id, title, description, deadline, is_active, created_by, created_at, custom_fields, google_forms_config, sections_config, payment_setting_id) FROM stdin;
6	HZ8K07XC	4	Fellowship Application Form in Ophthalmology-July 2026	Sankara Academy of Vision Fellowship Application for July 2026 intake.	\N	t	11	2026-05-06 10:57:47.814657+05:30	[]	null	[{"id": "instructions", "title": "Key Instructions", "fields": [{"id": "intro_text", "type": "info", "label": "Instructions", "defaultValue": "1. Candidates can now apply for multiple Sub-specialties in a single application form.\\n2. Kindly carry your basic and post-graduate educational certificates, current valid medical registration license and passport - size photograph\\n3. Selection process for the fellowship involves a written test (MCQ pattern) and an interview\\n4. Application fee of Rs.2750/- can be paid only through online transfer...\\n5. The age limit of the applicant to apply for the fellowships is 35 years..."}], "enabled": true, "description": "Please read the following instructions carefully before proceeding."}, {"id": "subspecialty", "title": "Subspecialty Selection", "fields": [{"id": "specialization", "type": "checkbox_group", "label": "Subspecialties", "mapping": "specialization", "options": ["Cornea", "Glaucoma", "IOL", "Oculoplasty", "Pediatric Ophthalmology", "Phaco Refractive", "Medical Retina", "Vitreo Retina"], "required": true, "isStandard": true}], "enabled": true, "description": "Select the option(s) for which you are applying. You can select more than one."}, {"id": "units", "title": "Speciality : Units (Select the preferences)", "fields": [{"id": "unit_cornea", "type": "select", "label": "Cornea Preferred Center", "options": ["Bangalore", "Coimbatore", "Guntur", "Jaipur", "Shimoga", "Not Applicable"], "visibleIf": {"field": "specialization", "contains": "Cornea"}}, {"id": "unit_glaucoma", "type": "select", "label": "Glaucoma Preferred Center", "options": ["Bangalore", "Coimbatore", "Guntur", "Shimoga", "Not Applicable"], "visibleIf": {"field": "specialization", "contains": "Glaucoma"}}, {"id": "unit_iol", "type": "select", "label": "IOL Preferred Center", "options": ["Anand", "Bangalore", "Guntur", "Hyderabad", "Indore", "Jaipur", "Kanpur", "Krishnankoil", "Ludhiana", "Panvel", "Shimoga", "Varanasi", "Not Applicable"], "visibleIf": {"field": "specialization", "contains": "IOL"}}, {"id": "unit_medical_retina", "type": "select", "label": "Medical Retina Preferred Center", "options": ["Bangalore", "Coimbatore", "Guntur", "Jaipur", "Shimoga", "Not Applicable"], "visibleIf": {"field": "specialization", "contains": "Medical Retina"}}, {"id": "unit_oculoplasty", "type": "select", "label": "Oculoplasty Preferred Center", "options": ["Bangalore", "Coimbatore", "Guntur", "Not Applicable"], "visibleIf": {"field": "specialization", "contains": "Oculoplasty"}}, {"id": "unit_pediatric", "type": "select", "label": "Pediatric Preferred Center", "options": ["Bangalore", "Coimbatore", "Guntur", "Shimoga", "Not Applicable"], "visibleIf": {"field": "specialization", "contains": "Pediatric Ophthalmology"}}, {"id": "unit_phaco", "type": "select", "label": "Phaco Refractive Preferred Center", "options": ["Bangalore", "Not Applicable"], "visibleIf": {"field": "specialization", "contains": "Phaco Refractive"}}, {"id": "unit_vitreo_retina", "type": "select", "label": "Vitreo Retina Preferred Center", "options": ["Bangalore", "Coimbatore", "Guntur", "Shimoga", "Not Applicable"], "visibleIf": {"field": "specialization", "contains": "Vitreo Retina"}}, {"id": "referralSource", "type": "select", "label": "Where did you hear about this Fellowship?", "mapping": "referralSource", "options": ["Sankara Website", "Word of Mouth", "Referred by any Faculty or exiting trainee at Sankara", "IJO Advertisement", "Social Media Platforms (Instagram/Facebook/Whatsapp/LinkedIn)"], "required": true, "isStandard": true}], "enabled": true, "description": "Choose the preferred center for each fellowship."}, {"id": "referral_info", "title": "Referral Information", "fields": [{"id": "referredByName", "type": "text", "label": "Name of referred Faculty/Existing Trainee", "mapping": "referredByName", "isStandard": true}], "enabled": true, "description": "Details of the person who referred you."}, {"id": "social_media", "title": "Social Media", "fields": [{"id": "mediaSource", "type": "text", "label": "Media Source", "mapping": "mediaSource", "isStandard": true}], "enabled": true, "description": "Specify the media source if applicable."}, {"id": "personal_details", "title": "Let us know you better", "fields": [{"id": "fullName", "type": "text", "label": "Name in Full", "mapping": "fullName", "required": true, "isStandard": true}, {"id": "permanentAddress", "type": "textarea", "label": "Permanent Address", "mapping": "permanentAddress", "required": true, "isStandard": true}, {"id": "mailingAddress", "type": "textarea", "label": "Preferred Mailing Address (or N/A)", "mapping": "mailingAddress", "required": true, "isStandard": true}, {"id": "phone", "type": "phone", "label": "Mobile Number (10 digits)", "mapping": "phone", "required": true, "isStandard": true}, {"id": "email", "type": "text", "label": "E-mail ID", "mapping": "email", "required": true, "isStandard": true}, {"id": "dateOfBirth", "type": "date", "label": "Date of Birth", "mapping": "dateOfBirth", "required": true, "isStandard": true}, {"id": "maritalStatus", "type": "radio", "label": "Marital Status", "mapping": "maritalStatus", "options": ["Married", "Unmarried"], "required": true, "isStandard": true}, {"id": "spouseDetails", "type": "text", "label": "If Married, Spouse Details (Name & Profession)", "mapping": "spouseDetails", "isStandard": true}], "enabled": true, "description": "Basic information to identify you."}, {"id": "previous_entrance", "title": "Previous Entrance", "fields": [{"id": "prev_appeared", "type": "radio", "label": "Appeared Earlier?", "options": ["Yes", "No"]}, {"id": "previousApplicationMonthYear", "type": "text", "label": "If Yes, Month & Year", "mapping": "previousApplicationMonthYear", "visibleIf": {"field": "prev_appeared", "equals": "Yes"}, "isStandard": true}], "enabled": true, "description": "Did you appear for the entrance earlier?"}, {"id": "medical_history", "title": "Medical History", "fields": [{"id": "medicalConditions", "type": "checkbox_group", "label": "Ailments / Medications", "mapping": "medicalConditions", "options": ["Asthma", "Hypertension", "Diabetes", "Skin Allergy", "Hearing Impairment", "Tuberculosis", "Post Covid", "None of the Above"], "isStandard": true}], "enabled": true, "description": "Declare any ailments."}, {"id": "educational_qual", "title": "Educational Qualifications", "fields": [{"id": "medicalCollege", "type": "text", "label": "Medical College Qualified From", "mapping": "medicalCollege", "required": true, "isStandard": true}, {"id": "university", "type": "text", "label": "University (MBBS Awarded)", "mapping": "university", "required": true, "isStandard": true}, {"id": "qualification_matrix", "type": "qualification_matrix", "label": "Postgraduate Qualifications", "mapping": "qualificationMatrix", "isStandard": true}, {"id": "do_details", "type": "text", "label": "If DO: College, University & Year", "mapping": "doDetails", "visibleIf": {"key": "DO (Diploma Ophthlmology)", "field": "qualification_matrix", "equals": "Yes"}, "isStandard": true}, {"id": "ms_md_details", "type": "text", "label": "If MS: College, University & Year", "mapping": "msMdDetails", "visibleIf": {"key": "MS/MD ( Masters in Ophthalmology)", "field": "qualification_matrix", "equals": "Yes"}, "isStandard": true}, {"id": "dnb_details", "type": "text", "label": "If DNB: Institution & Year", "mapping": "dnbDetails", "visibleIf": {"key": "DNB", "field": "qualification_matrix", "equals": "Yes"}, "isStandard": true}, {"id": "otherTraining", "type": "text", "label": "Any Other Training / Certification", "mapping": "otherTraining", "isStandard": true}, {"id": "medicalCouncilNumber", "type": "text", "label": "Medical Council Registration Number", "mapping": "medicalCouncilNumber", "required": true, "isStandard": true}], "enabled": true, "description": "Undergraduate and Postgraduate details."}, {"id": "clinical_exp", "title": "Clinical Experience", "fields": [{"id": "diagnostic_skills", "rows": ["Slit Lamp", "Fundus Exam +90D", "Indirect Ophthalmoscopy", "Applanation Tonometry", "Gonioscopy", "Biometry (Keratometry, A Scan)", "Ultrasound B Scan", "Corneal Topgraphy", "Specular Microscopy", "Visual Fields (HFA)", "Fundus Flourescien Angiography (FFA)", "Ocular Coherence Tomography (OCT)", "Yag Capsulotomy /Iridotomy", "Argon LASER", "Hess Charting"], "type": "skills_table", "label": "Diagnostic Skills", "mapping": "diagnosticSkills", "options": ["Beginner", "Intermittent", "Expert"], "isStandard": true}, {"id": "surgery_experience", "rows": ["ECCE", "SICS", "PHACO", "TRABECULECTOMY", "RETINA LASERS", "DCR"], "type": "surgery_table", "label": "Surgical Experience", "mapping": "surgicalExperience", "isStandard": true}, {"id": "totalSurgeries", "type": "number", "label": "Total No. of Surgeries performed till date (Confirmation)", "mapping": "totalSurgeries", "required": true, "isStandard": true}], "enabled": true, "description": "Document your diagnostic and surgical experience."}, {"id": "publications", "title": "Publications & Presentation", "fields": [{"id": "publications", "type": "textarea", "label": "Journal Publications", "mapping": "publications", "required": true, "isStandard": true}, {"id": "presentations", "type": "textarea", "label": "Conference Presentations", "mapping": "presentations", "required": true, "isStandard": true}], "enabled": true, "description": "Academic presentations & publications."}, {"id": "lor", "title": "LETTER OF RECOMMENDATION (LOR)", "fields": [{"id": "lor1Url", "type": "file", "label": "LOR 1 PDF", "mapping": "lor1Url", "required": true, "isStandard": true}, {"id": "lor1RefName", "type": "text", "label": "Name & Designation of Reference 1", "mapping": "lor1RefName", "required": true, "isStandard": true}, {"id": "lor1RefContact", "type": "text", "label": "Contact number of Reference 1", "mapping": "lor1RefContact", "required": true, "isStandard": true}, {"id": "lor1RefEmail", "type": "text", "label": "Email ID of Reference 1", "mapping": "lor1RefEmail", "required": true, "isStandard": true}, {"id": "lor2Url", "type": "file", "label": "LOR 2 PDF", "mapping": "lor2Url", "required": true, "isStandard": true}, {"id": "lor2RefName", "type": "text", "label": "Name & Designation of Reference 2", "mapping": "lor2RefName", "required": true, "isStandard": true}, {"id": "lor2RefContact", "type": "text", "label": "Contact number of Reference 2", "mapping": "lor2RefContact", "required": true, "isStandard": true}, {"id": "lor2RefEmail", "type": "text", "label": "Email ID of Reference 2", "mapping": "lor2RefEmail", "required": true, "isStandard": true}], "enabled": true, "description": "Upload two LORs from the last 6 months (PDF)."}, {"id": "final", "title": "Declaration & Payment", "fields": [{"id": "photoUrl", "type": "file", "label": "Passport Size Photograph", "mapping": "photoUrl", "required": true, "isStandard": true}, {"id": "declarationAccepted", "type": "checkbox", "label": "I hereby declare that the information provided is true to the best of my knowledge.", "mapping": "declarationAccepted", "required": true, "isStandard": true}], "enabled": true, "description": "Final information and documents."}]	\N
\.


--
-- Data for Name: application_submissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.application_submissions (id, application_id, form_id, save_as_draft, status, specialization, center_preference, referral_source, referred_by_name, media_source, full_name, permanent_address, mailing_address, phone, email, date_of_birth, marital_status, spouse_details, health_declaration, health_details, medical_conditions, previous_application_month_year, degree, medical_college, university, pg_qualifications, do_qualification, do_details, ms_md_qualification, ms_md_details, dnb_qualification, dnb_details, other_training, medical_council_number, diagnostic_skills, surgical_experience, total_surgeries, publications, presentations, lor1_url, lor1_ref_name, lor1_ref_contact, lor1_ref_email, lor2_url, lor2_ref_name, lor2_ref_contact, lor2_ref_email, other_information, declaration_accepted, payment_url, photo_url, custom_answers, source, ready_for_review, google_forms_response_id, review_notes, submitted_at, reviewed_at, qualification_matrix) FROM stdin;
5	703c21cf-4046-4cff-a7b8-b87234ed296a	6	f	approved	{"IOL"}	\N	Word of Mouth			Test	Test	Test	8951568286	prabh.bhat12@gmail.com	2004-02-12	Unmarried		\N	\N	["None of the Above"]		\N	Test	Test	\N	\N	\N	\N	\N	\N	\N	Test	12345	\N	\N	5	Test	Test	/objects/uploads/Test/v6t88amdr1.pdf	Test	Test	test	/objects/uploads/Test/5kahmwqmdyu.pdf	Test	Test	Test	\N	t	razorpay:pay_Slzsgf1J0sEsaT	/objects/uploads/Test/ym5dqpfygi.jpg	{"unit_iol": "Guntur", "intro_text": "1. Candidates can now apply for multiple Sub-specialties in a single application form.\\n2. Kindly carry your basic and post-graduate educational certificates, current valid medical registration license and passport - size photograph\\n3. Selection process for the fellowship involves a written test (MCQ pattern) and an interview\\n4. Application fee of Rs.2750/- can be paid only through online transfer...\\n5. The age limit of the applicant to apply for the fellowships is 35 years...", "prev_appeared": "No"}	internal	f	\N	\N	2026-05-06 13:02:32.41+05:30	2026-05-06 13:12:51.923+05:30	\N
4	408d1c44-e81d-4c50-9de9-3a2f44c72b6a	6	f	approved	{"Vitreo Retina"}	\N	Word of Mouth			Test	Test	Test	8951568286	prabh.bhat12@gmail.com	2004-02-12	Unmarried		\N	\N	["None of the Above"]		\N	Test	Test	\N	\N	\N	\N	\N	\N	\N	\N	132345	\N	\N	2	Test	Test	/objects/uploads/Test/fswfn6uf6j.pdf	Test	Test	test2123.COM	/objects/uploads/Test/malg2lsgpz.pdf	Test	+91555548753	test2@ss.in	\N	t	razorpay:pay_SlziOe7E8L54eo	/objects/uploads/Test/nq893ti18e.jpg	{"intro_text": "1. Candidates can now apply for multiple Sub-specialties in a single application form.\\n2. Kindly carry your basic and post-graduate educational certificates, current valid medical registration license and passport - size photograph\\n3. Selection process for the fellowship involves a written test (MCQ pattern) and an interview\\n4. Application fee of Rs.2750/- can be paid only through online transfer...\\n5. The age limit of the applicant to apply for the fellowships is 35 years...", "prev_appeared": "No", "unit_vitreo_retina": "Guntur"}	internal	f	\N	\N	2026-05-06 12:52:50.72+05:30	2026-05-06 13:12:51.927+05:30	\N
6	673bcc1b-444b-445d-a266-feacc1ed2158	6	f	pending	{"IOL"}	\N	IJO Advertisement			Prabhanjana K	Shivamogga Karnataka 	NA	8951568286	prabh.bhat12@gmail.com	2004-02-12	Unmarried		\N	\N	["None of the Above"]		\N	Test College	Test Uni	\N	\N	\N	\N	\N	\N	\N	NA	12344	{"Slit Lamp":"Intermittent","Fundus Exam +90D":"Intermittent","Indirect Ophthalmoscopy":"Intermittent","Applanation Tonometry":"Beginner","Gonioscopy":"Expert","Biometry (Keratometry, A Scan)":"Intermittent","Ultrasound B Scan":"Beginner","Corneal Topgraphy":"Intermittent","Specular Microscopy":"Expert","Visual Fields (HFA)":"Intermittent","Fundus Flourescien Angiography (FFA)":"Beginner","Ocular Coherence Tomography (OCT)":"Intermittent","Yag Capsulotomy /Iridotomy":"Expert","Argon LASER":"Intermittent","Hess Charting":"Beginner"}	{"ECCE":{"supervision":1,"independent":13},"PHACO":{"supervision":13,"independent":13},"SICS":{"supervision":13,"independent":33},"TRABECULECTOMY":{"supervision":4,"independent":55},"RETINA LASERS":{"independent":43,"supervision":2},"DCR":{"independent":45,"supervision":22}}	257	NA	NA	/objects/uploads/Prabhanjana_K/ml4zzxm9jh.pdf	Raj	4433233433	test@mail.com	/objects/uploads/Prabhanjana_K/kd41j22i0x.pdf	Kumar	78945612302	test2@mail.org	\N	t	razorpay:pay_Sm1XArZwGhQpml	/objects/uploads/Prabhanjana_K/kzq2sjert8j.png	{"unit_iol": "Kanpur", "intro_text": "1. Candidates can now apply for multiple Sub-specialties in a single application form.\\n2. Kindly carry your basic and post-graduate educational certificates, current valid medical registration license and passport - size photograph\\n3. Selection process for the fellowship involves a written test (MCQ pattern) and an interview\\n4. Application fee of Rs.2750/- can be paid only through online transfer...\\n5. The age limit of the applicant to apply for the fellowships is 35 years...", "prev_appeared": "No"}	internal	f	\N	\N	2026-05-06 14:39:34.601+05:30	\N	\N
7	c8a0005d-3f5e-4869-ba53-d188ebfff7f5	6	f	approved	{"Glaucoma","Pediatric Ophthalmology"}	\N	Sankara Website	Test Name	NA	Prabhanjan K	Shivamogga Karnataka - 577202	NA	8951568286	prabhanjanakumaraswamy@gmail.com	1990-02-12	Unmarried		\N	\N	["None of the Above"]		\N	Test College	Test University	\N	\N	\N	\N	\N	\N	\N	\N	12345	{"Slit Lamp":"Beginner","Fundus Exam +90D":"Intermittent","Indirect Ophthalmoscopy":"Beginner","Applanation Tonometry":"Expert","Visual Fields (HFA)":"Beginner","Specular Microscopy":"Beginner","Corneal Topgraphy":"Beginner","Gonioscopy":"Intermittent","Biometry (Keratometry, A Scan)":"Intermittent","Ultrasound B Scan":"Intermittent","Fundus Flourescien Angiography (FFA)":"Intermittent","Ocular Coherence Tomography (OCT)":"Expert","Yag Capsulotomy /Iridotomy":"Beginner","Argon LASER":"Expert","Hess Charting":"Beginner"}	{"ECCE":{"supervision":1,"independent":1},"SICS":{"supervision":1,"independent":1},"PHACO":{"supervision":1,"independent":1},"TRABECULECTOMY":{"supervision":1,"independent":1},"RETINA LASERS":{"supervision":1,"independent":1},"DCR":{"supervision":1,"independent":1}}	12	NA	NA	/objects/uploads/Prabhanjan_K/6k9rzy7bwxj.pdf	TEST	9855647523	testref@gmail.com	/objects/uploads/Prabhanjan_K/j8vr8u5as3a.pdf	TEST 2	7855463215	test2@gmail.com	\N	t	razorpay:pay_Sm1cHvy5BEQFER	/objects/uploads/Prabhanjan_K/qh9ami345yi.png	{"intro_text": "1. Candidates can now apply for multiple Sub-specialties in a single application form.\\n2. Kindly carry your basic and post-graduate educational certificates, current valid medical registration license and passport - size photograph\\n3. Selection process for the fellowship involves a written test (MCQ pattern) and an interview\\n4. Application fee of Rs.2750/- can be paid only through online transfer...\\n5. The age limit of the applicant to apply for the fellowships is 35 years...", "prev_appeared": "No", "unit_glaucoma": "Coimbatore", "unit_pediatric": "Bangalore"}	internal	f	\N	\N	2026-05-06 14:44:25.518+05:30	2026-05-06 14:45:14.257+05:30	\N
\.


--
-- Data for Name: candidate_exam_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.candidate_exam_assignments (id, candidate_id, exam_id, assigned_at) FROM stdin;
\.


--
-- Data for Name: candidate_preferences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.candidate_preferences (id, candidate_id, speciality_id, preference_order, created_at) FROM stdin;
\.


--
-- Data for Name: candidates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.candidates (id, user_id, candidate_code, full_name, email, phone, date_of_birth, gender, qualification, college_name, address, unit_id, status, created_at, updated_at) FROM stdin;
2	\N	SAV-2026-7YOC	Test	prabh.bhat12@gmail.com	8951568286	2004-02-12	\N	\N	Test	Test	\N	allocated	2026-05-06 13:12:51.916115+05:30	2026-05-06 13:13:10.053+05:30
3	\N	SAV-2026-419B	Prabhanjan K	prabhanjanakumaraswamy@gmail.com	8951568286	1990-02-12	\N	\N	Test College	Shivamogga Karnataka - 577202	\N	pending	2026-05-06 14:45:14.253327+05:30	2026-05-06 14:45:33.846+05:30
\.


--
-- Data for Name: doctor_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.doctor_assignments (id, doctor_id, candidate_id, status, scheduled_at, created_at) FROM stdin;
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.documents (id, candidate_id, doc_type, file_name, file_url, uploaded_at) FROM stdin;
\.


--
-- Data for Name: exam_answers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.exam_answers (id, attempt_id, question_id, selected_index, created_at) FROM stdin;
\.


--
-- Data for Name: exam_attempts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.exam_attempts (id, candidate_id, exam_id, score, max_score, started_at, submitted_at) FROM stdin;
\.


--
-- Data for Name: exams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.exams (id, title, kind, program_id, duration_minutes, total_questions, passing_score, description, active, starts_at, ends_at, created_at) FROM stdin;
\.


--
-- Data for Name: interview_panel_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.interview_panel_members (id, panel_id, doctor_id, is_main) FROM stdin;
1	1	13	f
2	1	14	f
\.


--
-- Data for Name: interview_panels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.interview_panels (id, name, room_number, program_id, is_active, created_at) FROM stdin;
1	A	112	\N	t	2026-05-06 13:10:56.349999+05:30
\.


--
-- Data for Name: interview_scores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.interview_scores (id, candidate_id, doctor_id, score, remarks, submitted_at) FROM stdin;
\.


--
-- Data for Name: panel_queue; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.panel_queue (id, panel_id, candidate_id, queue_position, status, called_at, created_at) FROM stdin;
2	1	3	0	done	2026-05-06 14:45:39.747038+05:30	2026-05-06 14:45:33.890766+05:30
\.


--
-- Data for Name: payment_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_settings (id, program_id, razorpay_key_id, razorpay_key_secret, amount, currency, description, mode, upi_id, is_active, created_at, updated_at) FROM stdin;
1	\N	rzp_test_SlgNbXAEE5rBdc	uyKxr4J1QCHDlBb9FBoMn3pd	275000	INR	Fellowship Application Fee	live	prabhanjanakumaraswamy-1@okaxis	t	2026-05-05 16:11:37.224066+05:30	2026-05-05 18:04:30.011+05:30
\.


--
-- Data for Name: programs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.programs (id, name, code, description, academic_year, created_at) FROM stdin;
1	Long-term Fellowship in Vitreo-Retinal Surgery	VR-2026	Two-year vitreo-retinal surgical fellowship across Sankara units.	2026-27	2026-05-05 13:08:18.706074+05:30
2	Long-term Fellowship in Cornea & Refractive Surgery	CR-2026	Two-year fellowship in cornea, refractive surgery, and ocular surface diseases.	2026-27	2026-05-05 13:08:18.706074+05:30
3	Test	dd		2026	2026-05-05 13:22:43.011834+05:30
4	Fellowship Program - July 2026	FP-JUL-2026	Sankara Academy of Vision Fellowship Program for July 2026 batch.	20262026-27	2026-05-06 10:56:34.713659+05:30
\.


--
-- Data for Name: questions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.questions (id, exam_id, text, choices, correct_index, explanation, created_at) FROM stdin;
\.


--
-- Data for Name: seat_matrix_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.seat_matrix_entries (id, program_id, speciality, unit_name, total_seats, allocated_seats, created_at, updated_at) FROM stdin;
1	1	Cornea	Anand	0	0	2026-05-06 13:11:49.989959+05:30	2026-05-06 13:11:49.989959+05:30
2	1	Cornea	Bangalore	1	0	2026-05-06 13:11:49.999611+05:30	2026-05-06 13:11:49.999611+05:30
3	1	Cornea	Coimbatore	1	0	2026-05-06 13:11:50.000447+05:30	2026-05-06 13:11:50.000447+05:30
4	1	Cornea	Guntur	0	0	2026-05-06 13:11:50.001211+05:30	2026-05-06 13:11:50.001211+05:30
5	1	Cornea	Hyderabad	3	0	2026-05-06 13:11:50.001676+05:30	2026-05-06 13:11:50.001676+05:30
6	1	Cornea	Indore	0	0	2026-05-06 13:11:50.002372+05:30	2026-05-06 13:11:50.002372+05:30
7	1	Cornea	Jaipur	1	0	2026-05-06 13:11:50.002862+05:30	2026-05-06 13:11:50.002862+05:30
8	1	Cornea	Kanpur	0	0	2026-05-06 13:11:50.003372+05:30	2026-05-06 13:11:50.003372+05:30
9	1	Cornea	Krishnankoil	0	0	2026-05-06 13:11:50.004082+05:30	2026-05-06 13:11:50.004082+05:30
10	1	Cornea	Ludhiana	0	0	2026-05-06 13:11:50.004531+05:30	2026-05-06 13:11:50.004531+05:30
11	1	Cornea	Panvel	0	0	2026-05-06 13:11:50.005038+05:30	2026-05-06 13:11:50.005038+05:30
12	1	Cornea	Shimoga	1	0	2026-05-06 13:11:50.006331+05:30	2026-05-06 13:11:50.006331+05:30
13	1	Cornea	Varanasi	0	0	2026-05-06 13:11:50.007144+05:30	2026-05-06 13:11:50.007144+05:30
14	1	Glaucoma	Anand	0	0	2026-05-06 13:11:50.01401+05:30	2026-05-06 13:11:50.01401+05:30
15	1	Glaucoma	Bangalore	1	0	2026-05-06 13:11:50.014484+05:30	2026-05-06 13:11:50.014484+05:30
16	1	Glaucoma	Coimbatore	1	0	2026-05-06 13:11:50.014932+05:30	2026-05-06 13:11:50.014932+05:30
17	1	Glaucoma	Guntur	0	0	2026-05-06 13:11:50.015313+05:30	2026-05-06 13:11:50.015313+05:30
18	1	Glaucoma	Hyderabad	2	0	2026-05-06 13:11:50.015748+05:30	2026-05-06 13:11:50.015748+05:30
19	1	Glaucoma	Indore	0	0	2026-05-06 13:11:50.016277+05:30	2026-05-06 13:11:50.016277+05:30
20	1	Glaucoma	Jaipur	1	0	2026-05-06 13:11:50.01695+05:30	2026-05-06 13:11:50.01695+05:30
21	1	Glaucoma	Kanpur	0	0	2026-05-06 13:11:50.017469+05:30	2026-05-06 13:11:50.017469+05:30
22	1	Glaucoma	Krishnankoil	0	0	2026-05-06 13:11:50.017969+05:30	2026-05-06 13:11:50.017969+05:30
23	1	Glaucoma	Ludhiana	0	0	2026-05-06 13:11:50.018373+05:30	2026-05-06 13:11:50.018373+05:30
24	1	Glaucoma	Panvel	0	0	2026-05-06 13:11:50.018739+05:30	2026-05-06 13:11:50.018739+05:30
25	1	Glaucoma	Shimoga	0	0	2026-05-06 13:11:50.019102+05:30	2026-05-06 13:11:50.019102+05:30
26	1	Glaucoma	Varanasi	0	0	2026-05-06 13:11:50.019475+05:30	2026-05-06 13:11:50.019475+05:30
27	1	IOL Fellowship	Anand	2	0	2026-05-06 13:11:50.021946+05:30	2026-05-06 13:11:50.021946+05:30
28	1	IOL Fellowship	Bangalore	1	0	2026-05-06 13:11:50.022421+05:30	2026-05-06 13:11:50.022421+05:30
29	1	IOL Fellowship	Coimbatore	2	0	2026-05-06 13:11:50.022917+05:30	2026-05-06 13:11:50.022917+05:30
30	1	IOL Fellowship	Guntur	3	0	2026-05-06 13:11:50.023359+05:30	2026-05-06 13:11:50.023359+05:30
31	1	IOL Fellowship	Hyderabad	4	0	2026-05-06 13:11:50.023763+05:30	2026-05-06 13:11:50.023763+05:30
32	1	IOL Fellowship	Indore	2	0	2026-05-06 13:11:50.024126+05:30	2026-05-06 13:11:50.024126+05:30
33	1	IOL Fellowship	Jaipur	2	0	2026-05-06 13:11:50.024556+05:30	2026-05-06 13:11:50.024556+05:30
34	1	IOL Fellowship	Kanpur	2	0	2026-05-06 13:11:50.024917+05:30	2026-05-06 13:11:50.024917+05:30
35	1	IOL Fellowship	Krishnankoil	4	0	2026-05-06 13:11:50.025294+05:30	2026-05-06 13:11:50.025294+05:30
36	1	IOL Fellowship	Ludhiana	2	0	2026-05-06 13:11:50.025659+05:30	2026-05-06 13:11:50.025659+05:30
37	1	IOL Fellowship	Panvel	1	0	2026-05-06 13:11:50.026076+05:30	2026-05-06 13:11:50.026076+05:30
38	1	IOL Fellowship	Shimoga	3	0	2026-05-06 13:11:50.026462+05:30	2026-05-06 13:11:50.026462+05:30
39	1	IOL Fellowship	Varanasi	3	0	2026-05-06 13:11:50.026833+05:30	2026-05-06 13:11:50.026833+05:30
40	1	Medical Retina	Anand	0	0	2026-05-06 13:11:50.027896+05:30	2026-05-06 13:11:50.027896+05:30
41	1	Medical Retina	Bangalore	1	0	2026-05-06 13:11:50.028254+05:30	2026-05-06 13:11:50.028254+05:30
42	1	Medical Retina	Coimbatore	1	0	2026-05-06 13:11:50.02865+05:30	2026-05-06 13:11:50.02865+05:30
43	1	Medical Retina	Guntur	0	0	2026-05-06 13:11:50.029043+05:30	2026-05-06 13:11:50.029043+05:30
44	1	Medical Retina	Hyderabad	3	0	2026-05-06 13:11:50.029399+05:30	2026-05-06 13:11:50.029399+05:30
45	1	Medical Retina	Indore	1	0	2026-05-06 13:11:50.02977+05:30	2026-05-06 13:11:50.02977+05:30
46	1	Medical Retina	Jaipur	0	0	2026-05-06 13:11:50.030221+05:30	2026-05-06 13:11:50.030221+05:30
47	1	Medical Retina	Kanpur	0	0	2026-05-06 13:11:50.03062+05:30	2026-05-06 13:11:50.03062+05:30
48	1	Medical Retina	Krishnankoil	0	0	2026-05-06 13:11:50.030997+05:30	2026-05-06 13:11:50.030997+05:30
49	1	Medical Retina	Ludhiana	1	0	2026-05-06 13:11:50.031785+05:30	2026-05-06 13:11:50.031785+05:30
50	1	Medical Retina	Panvel	0	0	2026-05-06 13:11:50.032174+05:30	2026-05-06 13:11:50.032174+05:30
51	1	Medical Retina	Shimoga	0	0	2026-05-06 13:11:50.032737+05:30	2026-05-06 13:11:50.032737+05:30
52	1	Medical Retina	Varanasi	0	0	2026-05-06 13:11:50.033251+05:30	2026-05-06 13:11:50.033251+05:30
53	1	Oculoplasty	Anand	0	0	2026-05-06 13:11:50.034423+05:30	2026-05-06 13:11:50.034423+05:30
54	1	Oculoplasty	Bangalore	1	0	2026-05-06 13:11:50.03489+05:30	2026-05-06 13:11:50.03489+05:30
55	1	Oculoplasty	Coimbatore	0	0	2026-05-06 13:11:50.035333+05:30	2026-05-06 13:11:50.035333+05:30
56	1	Oculoplasty	Guntur	0	0	2026-05-06 13:11:50.035746+05:30	2026-05-06 13:11:50.035746+05:30
57	1	Oculoplasty	Hyderabad	0	0	2026-05-06 13:11:50.036196+05:30	2026-05-06 13:11:50.036196+05:30
58	1	Oculoplasty	Indore	0	0	2026-05-06 13:11:50.036621+05:30	2026-05-06 13:11:50.036621+05:30
59	1	Oculoplasty	Jaipur	0	0	2026-05-06 13:11:50.037043+05:30	2026-05-06 13:11:50.037043+05:30
60	1	Oculoplasty	Kanpur	0	0	2026-05-06 13:11:50.037485+05:30	2026-05-06 13:11:50.037485+05:30
61	1	Oculoplasty	Krishnankoil	0	0	2026-05-06 13:11:50.037909+05:30	2026-05-06 13:11:50.037909+05:30
62	1	Oculoplasty	Ludhiana	0	0	2026-05-06 13:11:50.038326+05:30	2026-05-06 13:11:50.038326+05:30
63	1	Oculoplasty	Panvel	1	0	2026-05-06 13:11:50.03879+05:30	2026-05-06 13:11:50.03879+05:30
64	1	Oculoplasty	Shimoga	0	0	2026-05-06 13:11:50.039255+05:30	2026-05-06 13:11:50.039255+05:30
65	1	Oculoplasty	Varanasi	1	0	2026-05-06 13:11:50.040123+05:30	2026-05-06 13:11:50.040123+05:30
66	1	Pediatric Ophthalmology	Anand	0	0	2026-05-06 13:11:50.041163+05:30	2026-05-06 13:11:50.041163+05:30
67	1	Pediatric Ophthalmology	Bangalore	1	0	2026-05-06 13:11:50.041563+05:30	2026-05-06 13:11:50.041563+05:30
68	1	Pediatric Ophthalmology	Coimbatore	0	0	2026-05-06 13:11:50.041935+05:30	2026-05-06 13:11:50.041935+05:30
69	1	Pediatric Ophthalmology	Guntur	0	0	2026-05-06 13:11:50.042308+05:30	2026-05-06 13:11:50.042308+05:30
70	1	Pediatric Ophthalmology	Hyderabad	1	0	2026-05-06 13:11:50.043168+05:30	2026-05-06 13:11:50.043168+05:30
71	1	Pediatric Ophthalmology	Indore	0	0	2026-05-06 13:11:50.043592+05:30	2026-05-06 13:11:50.043592+05:30
72	1	Pediatric Ophthalmology	Jaipur	0	0	2026-05-06 13:11:50.04398+05:30	2026-05-06 13:11:50.04398+05:30
73	1	Pediatric Ophthalmology	Kanpur	0	0	2026-05-06 13:11:50.044358+05:30	2026-05-06 13:11:50.044358+05:30
74	1	Pediatric Ophthalmology	Krishnankoil	0	0	2026-05-06 13:11:50.044702+05:30	2026-05-06 13:11:50.044702+05:30
75	1	Pediatric Ophthalmology	Ludhiana	1	0	2026-05-06 13:11:50.045094+05:30	2026-05-06 13:11:50.045094+05:30
76	1	Pediatric Ophthalmology	Panvel	0	0	2026-05-06 13:11:50.04546+05:30	2026-05-06 13:11:50.04546+05:30
77	1	Pediatric Ophthalmology	Shimoga	1	0	2026-05-06 13:11:50.045852+05:30	2026-05-06 13:11:50.045852+05:30
78	1	Pediatric Ophthalmology	Varanasi	0	0	2026-05-06 13:11:50.046213+05:30	2026-05-06 13:11:50.046213+05:30
79	1	Phaco Refractive	Anand	0	0	2026-05-06 13:11:50.047208+05:30	2026-05-06 13:11:50.047208+05:30
80	1	Phaco Refractive	Bangalore	1	0	2026-05-06 13:11:50.047589+05:30	2026-05-06 13:11:50.047589+05:30
81	1	Phaco Refractive	Coimbatore	0	0	2026-05-06 13:11:50.047979+05:30	2026-05-06 13:11:50.047979+05:30
82	1	Phaco Refractive	Guntur	0	0	2026-05-06 13:11:50.048327+05:30	2026-05-06 13:11:50.048327+05:30
83	1	Phaco Refractive	Hyderabad	0	0	2026-05-06 13:11:50.048694+05:30	2026-05-06 13:11:50.048694+05:30
84	1	Phaco Refractive	Indore	0	0	2026-05-06 13:11:50.049301+05:30	2026-05-06 13:11:50.049301+05:30
85	1	Phaco Refractive	Jaipur	0	0	2026-05-06 13:11:50.049831+05:30	2026-05-06 13:11:50.049831+05:30
86	1	Phaco Refractive	Kanpur	0	0	2026-05-06 13:11:50.050306+05:30	2026-05-06 13:11:50.050306+05:30
87	1	Phaco Refractive	Krishnankoil	0	0	2026-05-06 13:11:50.050665+05:30	2026-05-06 13:11:50.050665+05:30
88	1	Phaco Refractive	Ludhiana	0	0	2026-05-06 13:11:50.051026+05:30	2026-05-06 13:11:50.051026+05:30
89	1	Phaco Refractive	Panvel	0	0	2026-05-06 13:11:50.051555+05:30	2026-05-06 13:11:50.051555+05:30
90	1	Phaco Refractive	Shimoga	0	0	2026-05-06 13:11:50.052621+05:30	2026-05-06 13:11:50.052621+05:30
91	1	Phaco Refractive	Varanasi	0	0	2026-05-06 13:11:50.053032+05:30	2026-05-06 13:11:50.053032+05:30
92	1	Vitreo Retina	Anand	0	0	2026-05-06 13:11:50.053981+05:30	2026-05-06 13:11:50.053981+05:30
93	1	Vitreo Retina	Bangalore	3	0	2026-05-06 13:11:50.05434+05:30	2026-05-06 13:11:50.05434+05:30
94	1	Vitreo Retina	Coimbatore	1	0	2026-05-06 13:11:50.054683+05:30	2026-05-06 13:11:50.054683+05:30
95	1	Vitreo Retina	Guntur	0	0	2026-05-06 13:11:50.055025+05:30	2026-05-06 13:11:50.055025+05:30
96	1	Vitreo Retina	Hyderabad	2	0	2026-05-06 13:11:50.055368+05:30	2026-05-06 13:11:50.055368+05:30
97	1	Vitreo Retina	Indore	1	0	2026-05-06 13:11:50.056719+05:30	2026-05-06 13:11:50.056719+05:30
98	1	Vitreo Retina	Jaipur	0	0	2026-05-06 13:11:50.057138+05:30	2026-05-06 13:11:50.057138+05:30
99	1	Vitreo Retina	Kanpur	0	0	2026-05-06 13:11:50.057569+05:30	2026-05-06 13:11:50.057569+05:30
100	1	Vitreo Retina	Krishnankoil	0	0	2026-05-06 13:11:50.057961+05:30	2026-05-06 13:11:50.057961+05:30
101	1	Vitreo Retina	Ludhiana	0	0	2026-05-06 13:11:50.058365+05:30	2026-05-06 13:11:50.058365+05:30
102	1	Vitreo Retina	Panvel	0	0	2026-05-06 13:11:50.058757+05:30	2026-05-06 13:11:50.058757+05:30
103	1	Vitreo Retina	Shimoga	1	0	2026-05-06 13:11:50.059111+05:30	2026-05-06 13:11:50.059111+05:30
104	1	Vitreo Retina	Varanasi	0	0	2026-05-06 13:11:50.059537+05:30	2026-05-06 13:11:50.059537+05:30
105	3	Cornea	Anand	0	0	2026-05-06 13:13:22.266971+05:30	2026-05-06 13:13:22.266971+05:30
106	3	Cornea	Bangalore	1	0	2026-05-06 13:13:22.290898+05:30	2026-05-06 13:13:22.290898+05:30
107	3	Cornea	Coimbatore	1	0	2026-05-06 13:13:22.291467+05:30	2026-05-06 13:13:22.291467+05:30
108	3	Cornea	Guntur	0	0	2026-05-06 13:13:22.292048+05:30	2026-05-06 13:13:22.292048+05:30
109	3	Cornea	Hyderabad	3	0	2026-05-06 13:13:22.292733+05:30	2026-05-06 13:13:22.292733+05:30
110	3	Cornea	Indore	0	0	2026-05-06 13:13:22.293178+05:30	2026-05-06 13:13:22.293178+05:30
111	3	Cornea	Jaipur	1	0	2026-05-06 13:13:22.293803+05:30	2026-05-06 13:13:22.293803+05:30
112	3	Cornea	Kanpur	0	0	2026-05-06 13:13:22.294173+05:30	2026-05-06 13:13:22.294173+05:30
113	3	Cornea	Krishnankoil	0	0	2026-05-06 13:13:22.294571+05:30	2026-05-06 13:13:22.294571+05:30
114	3	Cornea	Ludhiana	0	0	2026-05-06 13:13:22.294943+05:30	2026-05-06 13:13:22.294943+05:30
115	3	Cornea	Panvel	0	0	2026-05-06 13:13:22.29535+05:30	2026-05-06 13:13:22.29535+05:30
116	3	Cornea	Shimoga	1	0	2026-05-06 13:13:22.295742+05:30	2026-05-06 13:13:22.295742+05:30
117	3	Cornea	Varanasi	0	0	2026-05-06 13:13:22.296105+05:30	2026-05-06 13:13:22.296105+05:30
118	3	Glaucoma	Anand	0	0	2026-05-06 13:13:22.297295+05:30	2026-05-06 13:13:22.297295+05:30
119	3	Glaucoma	Bangalore	1	0	2026-05-06 13:13:22.297709+05:30	2026-05-06 13:13:22.297709+05:30
120	3	Glaucoma	Coimbatore	1	0	2026-05-06 13:13:22.298288+05:30	2026-05-06 13:13:22.298288+05:30
121	3	Glaucoma	Guntur	0	0	2026-05-06 13:13:22.298739+05:30	2026-05-06 13:13:22.298739+05:30
122	3	Glaucoma	Hyderabad	2	0	2026-05-06 13:13:22.299201+05:30	2026-05-06 13:13:22.299201+05:30
123	3	Glaucoma	Indore	0	0	2026-05-06 13:13:22.29962+05:30	2026-05-06 13:13:22.29962+05:30
124	3	Glaucoma	Jaipur	1	0	2026-05-06 13:13:22.300022+05:30	2026-05-06 13:13:22.300022+05:30
125	3	Glaucoma	Kanpur	0	0	2026-05-06 13:13:22.300534+05:30	2026-05-06 13:13:22.300534+05:30
126	3	Glaucoma	Krishnankoil	0	0	2026-05-06 13:13:22.301063+05:30	2026-05-06 13:13:22.301063+05:30
127	3	Glaucoma	Ludhiana	0	0	2026-05-06 13:13:22.301518+05:30	2026-05-06 13:13:22.301518+05:30
128	3	Glaucoma	Panvel	0	0	2026-05-06 13:13:22.301939+05:30	2026-05-06 13:13:22.301939+05:30
129	3	Glaucoma	Shimoga	0	0	2026-05-06 13:13:22.302379+05:30	2026-05-06 13:13:22.302379+05:30
130	3	Glaucoma	Varanasi	0	0	2026-05-06 13:13:22.302792+05:30	2026-05-06 13:13:22.302792+05:30
131	3	IOL Fellowship	Anand	2	0	2026-05-06 13:13:22.304258+05:30	2026-05-06 13:13:22.304258+05:30
132	3	IOL Fellowship	Bangalore	1	0	2026-05-06 13:13:22.304661+05:30	2026-05-06 13:13:22.304661+05:30
133	3	IOL Fellowship	Coimbatore	2	0	2026-05-06 13:13:22.305066+05:30	2026-05-06 13:13:22.305066+05:30
134	3	IOL Fellowship	Guntur	3	0	2026-05-06 13:13:22.305461+05:30	2026-05-06 13:13:22.305461+05:30
135	3	IOL Fellowship	Hyderabad	4	0	2026-05-06 13:13:22.305894+05:30	2026-05-06 13:13:22.305894+05:30
136	3	IOL Fellowship	Indore	2	0	2026-05-06 13:13:22.306269+05:30	2026-05-06 13:13:22.306269+05:30
137	3	IOL Fellowship	Jaipur	2	0	2026-05-06 13:13:22.30663+05:30	2026-05-06 13:13:22.30663+05:30
138	3	IOL Fellowship	Kanpur	2	0	2026-05-06 13:13:22.306975+05:30	2026-05-06 13:13:22.306975+05:30
139	3	IOL Fellowship	Krishnankoil	4	0	2026-05-06 13:13:22.307322+05:30	2026-05-06 13:13:22.307322+05:30
140	3	IOL Fellowship	Ludhiana	2	0	2026-05-06 13:13:22.307683+05:30	2026-05-06 13:13:22.307683+05:30
141	3	IOL Fellowship	Panvel	1	0	2026-05-06 13:13:22.30804+05:30	2026-05-06 13:13:22.30804+05:30
142	3	IOL Fellowship	Shimoga	3	0	2026-05-06 13:13:22.308377+05:30	2026-05-06 13:13:22.308377+05:30
143	3	IOL Fellowship	Varanasi	3	0	2026-05-06 13:13:22.308783+05:30	2026-05-06 13:13:22.308783+05:30
144	3	Medical Retina	Anand	0	0	2026-05-06 13:13:22.310188+05:30	2026-05-06 13:13:22.310188+05:30
145	3	Medical Retina	Bangalore	1	0	2026-05-06 13:13:22.310621+05:30	2026-05-06 13:13:22.310621+05:30
146	3	Medical Retina	Coimbatore	1	0	2026-05-06 13:13:22.311027+05:30	2026-05-06 13:13:22.311027+05:30
147	3	Medical Retina	Guntur	0	0	2026-05-06 13:13:22.311434+05:30	2026-05-06 13:13:22.311434+05:30
148	3	Medical Retina	Hyderabad	3	0	2026-05-06 13:13:22.311903+05:30	2026-05-06 13:13:22.311903+05:30
149	3	Medical Retina	Indore	1	0	2026-05-06 13:13:22.312751+05:30	2026-05-06 13:13:22.312751+05:30
150	3	Medical Retina	Jaipur	0	0	2026-05-06 13:13:22.313145+05:30	2026-05-06 13:13:22.313145+05:30
151	3	Medical Retina	Kanpur	0	0	2026-05-06 13:13:22.313572+05:30	2026-05-06 13:13:22.313572+05:30
152	3	Medical Retina	Krishnankoil	0	0	2026-05-06 13:13:22.31422+05:30	2026-05-06 13:13:22.31422+05:30
153	3	Medical Retina	Ludhiana	1	0	2026-05-06 13:13:22.314678+05:30	2026-05-06 13:13:22.314678+05:30
154	3	Medical Retina	Panvel	0	0	2026-05-06 13:13:22.315089+05:30	2026-05-06 13:13:22.315089+05:30
155	3	Medical Retina	Shimoga	0	0	2026-05-06 13:13:22.315445+05:30	2026-05-06 13:13:22.315445+05:30
156	3	Medical Retina	Varanasi	0	0	2026-05-06 13:13:22.315795+05:30	2026-05-06 13:13:22.315795+05:30
157	3	Oculoplasty	Anand	0	0	2026-05-06 13:13:22.316732+05:30	2026-05-06 13:13:22.316732+05:30
158	3	Oculoplasty	Bangalore	1	0	2026-05-06 13:13:22.317148+05:30	2026-05-06 13:13:22.317148+05:30
159	3	Oculoplasty	Coimbatore	0	0	2026-05-06 13:13:22.317532+05:30	2026-05-06 13:13:22.317532+05:30
160	3	Oculoplasty	Guntur	0	0	2026-05-06 13:13:22.317918+05:30	2026-05-06 13:13:22.317918+05:30
161	3	Oculoplasty	Hyderabad	0	0	2026-05-06 13:13:22.318286+05:30	2026-05-06 13:13:22.318286+05:30
162	3	Oculoplasty	Indore	0	0	2026-05-06 13:13:22.318648+05:30	2026-05-06 13:13:22.318648+05:30
163	3	Oculoplasty	Jaipur	0	0	2026-05-06 13:13:22.319035+05:30	2026-05-06 13:13:22.319035+05:30
164	3	Oculoplasty	Kanpur	0	0	2026-05-06 13:13:22.319477+05:30	2026-05-06 13:13:22.319477+05:30
165	3	Oculoplasty	Krishnankoil	0	0	2026-05-06 13:13:22.319882+05:30	2026-05-06 13:13:22.319882+05:30
166	3	Oculoplasty	Ludhiana	0	0	2026-05-06 13:13:22.320277+05:30	2026-05-06 13:13:22.320277+05:30
167	3	Oculoplasty	Panvel	1	0	2026-05-06 13:13:22.32068+05:30	2026-05-06 13:13:22.32068+05:30
168	3	Oculoplasty	Shimoga	0	0	2026-05-06 13:13:22.321209+05:30	2026-05-06 13:13:22.321209+05:30
169	3	Oculoplasty	Varanasi	1	0	2026-05-06 13:13:22.321925+05:30	2026-05-06 13:13:22.321925+05:30
170	3	Pediatric Ophthalmology	Anand	0	0	2026-05-06 13:13:22.322877+05:30	2026-05-06 13:13:22.322877+05:30
171	3	Pediatric Ophthalmology	Bangalore	1	0	2026-05-06 13:13:22.323265+05:30	2026-05-06 13:13:22.323265+05:30
172	3	Pediatric Ophthalmology	Coimbatore	0	0	2026-05-06 13:13:22.323625+05:30	2026-05-06 13:13:22.323625+05:30
173	3	Pediatric Ophthalmology	Guntur	0	0	2026-05-06 13:13:22.323971+05:30	2026-05-06 13:13:22.323971+05:30
174	3	Pediatric Ophthalmology	Hyderabad	1	0	2026-05-06 13:13:22.324341+05:30	2026-05-06 13:13:22.324341+05:30
175	3	Pediatric Ophthalmology	Indore	0	0	2026-05-06 13:13:22.324816+05:30	2026-05-06 13:13:22.324816+05:30
176	3	Pediatric Ophthalmology	Jaipur	0	0	2026-05-06 13:13:22.325171+05:30	2026-05-06 13:13:22.325171+05:30
177	3	Pediatric Ophthalmology	Kanpur	0	0	2026-05-06 13:13:22.325509+05:30	2026-05-06 13:13:22.325509+05:30
178	3	Pediatric Ophthalmology	Krishnankoil	0	0	2026-05-06 13:13:22.325863+05:30	2026-05-06 13:13:22.325863+05:30
179	3	Pediatric Ophthalmology	Ludhiana	1	0	2026-05-06 13:13:22.326285+05:30	2026-05-06 13:13:22.326285+05:30
180	3	Pediatric Ophthalmology	Panvel	0	0	2026-05-06 13:13:22.326693+05:30	2026-05-06 13:13:22.326693+05:30
181	3	Pediatric Ophthalmology	Shimoga	1	0	2026-05-06 13:13:22.327076+05:30	2026-05-06 13:13:22.327076+05:30
182	3	Pediatric Ophthalmology	Varanasi	0	0	2026-05-06 13:13:22.327429+05:30	2026-05-06 13:13:22.327429+05:30
183	3	Phaco Refractive	Anand	0	0	2026-05-06 13:13:22.328293+05:30	2026-05-06 13:13:22.328293+05:30
184	3	Phaco Refractive	Bangalore	1	0	2026-05-06 13:13:22.328628+05:30	2026-05-06 13:13:22.328628+05:30
185	3	Phaco Refractive	Coimbatore	0	0	2026-05-06 13:13:22.329111+05:30	2026-05-06 13:13:22.329111+05:30
186	3	Phaco Refractive	Guntur	0	0	2026-05-06 13:13:22.329531+05:30	2026-05-06 13:13:22.329531+05:30
187	3	Phaco Refractive	Hyderabad	0	0	2026-05-06 13:13:22.329908+05:30	2026-05-06 13:13:22.329908+05:30
188	3	Phaco Refractive	Indore	0	0	2026-05-06 13:13:22.330287+05:30	2026-05-06 13:13:22.330287+05:30
189	3	Phaco Refractive	Jaipur	0	0	2026-05-06 13:13:22.330676+05:30	2026-05-06 13:13:22.330676+05:30
190	3	Phaco Refractive	Kanpur	0	0	2026-05-06 13:13:22.331058+05:30	2026-05-06 13:13:22.331058+05:30
191	3	Phaco Refractive	Krishnankoil	0	0	2026-05-06 13:13:22.331407+05:30	2026-05-06 13:13:22.331407+05:30
192	3	Phaco Refractive	Ludhiana	0	0	2026-05-06 13:13:22.332844+05:30	2026-05-06 13:13:22.332844+05:30
193	3	Phaco Refractive	Panvel	0	0	2026-05-06 13:13:22.334028+05:30	2026-05-06 13:13:22.334028+05:30
194	3	Phaco Refractive	Shimoga	0	0	2026-05-06 13:13:22.334524+05:30	2026-05-06 13:13:22.334524+05:30
195	3	Phaco Refractive	Varanasi	0	0	2026-05-06 13:13:22.334911+05:30	2026-05-06 13:13:22.334911+05:30
196	3	Vitreo Retina	Anand	0	0	2026-05-06 13:13:22.33584+05:30	2026-05-06 13:13:22.33584+05:30
197	3	Vitreo Retina	Bangalore	3	0	2026-05-06 13:13:22.336173+05:30	2026-05-06 13:13:22.336173+05:30
198	3	Vitreo Retina	Coimbatore	1	0	2026-05-06 13:13:22.336508+05:30	2026-05-06 13:13:22.336508+05:30
199	3	Vitreo Retina	Guntur	0	0	2026-05-06 13:13:22.336885+05:30	2026-05-06 13:13:22.336885+05:30
200	3	Vitreo Retina	Hyderabad	2	0	2026-05-06 13:13:22.337231+05:30	2026-05-06 13:13:22.337231+05:30
201	3	Vitreo Retina	Indore	1	0	2026-05-06 13:13:22.338045+05:30	2026-05-06 13:13:22.338045+05:30
202	3	Vitreo Retina	Jaipur	0	0	2026-05-06 13:13:22.338535+05:30	2026-05-06 13:13:22.338535+05:30
203	3	Vitreo Retina	Kanpur	0	0	2026-05-06 13:13:22.339084+05:30	2026-05-06 13:13:22.339084+05:30
204	3	Vitreo Retina	Krishnankoil	0	0	2026-05-06 13:13:22.339594+05:30	2026-05-06 13:13:22.339594+05:30
205	3	Vitreo Retina	Ludhiana	0	0	2026-05-06 13:13:22.340004+05:30	2026-05-06 13:13:22.340004+05:30
206	3	Vitreo Retina	Panvel	0	0	2026-05-06 13:13:22.340477+05:30	2026-05-06 13:13:22.340477+05:30
207	3	Vitreo Retina	Shimoga	1	0	2026-05-06 13:13:22.34088+05:30	2026-05-06 13:13:22.34088+05:30
208	3	Vitreo Retina	Varanasi	0	0	2026-05-06 13:13:22.342371+05:30	2026-05-06 13:13:22.342371+05:30
\.


--
-- Data for Name: specialities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.specialities (id, program_id, name, code, seats, created_at) FROM stdin;
1	1	Vitreo-Retina	VR	4	2026-05-05 13:08:18.70802+05:30
3	1	Pediatric Retina	PR	2	2026-05-05 13:08:18.70802+05:30
4	2	Cornea & Anterior Segment	CAS	4	2026-05-05 13:08:18.709486+05:30
5	2	Refractive Surgery	RS	3	2026-05-05 13:08:18.709486+05:30
6	2	Ocular Surface	OS	2	2026-05-05 13:08:18.709486+05:30
7	1	Cornea	CORN	7	2026-05-06 13:11:50.012256+05:30
8	1	Glaucoma	GLAU	5	2026-05-06 13:11:50.021541+05:30
9	1	IOL Fellowship	IOLF	31	2026-05-06 13:11:50.027531+05:30
10	1	Medical Retina	MEDI	7	2026-05-06 13:11:50.034067+05:30
11	1	Oculoplasty	OCUL	3	2026-05-06 13:11:50.040819+05:30
12	1	Pediatric Ophthalmology	PEDI	4	2026-05-06 13:11:50.046901+05:30
13	1	Phaco Refractive	PHAC	1	2026-05-06 13:11:50.053644+05:30
14	1	Vitreo Retina	VITR	8	2026-05-06 13:11:50.060163+05:30
15	3	Cornea	CORN	7	2026-05-06 13:13:22.296825+05:30
16	3	Glaucoma	GLAU	5	2026-05-06 13:13:22.303921+05:30
17	3	IOL Fellowship	IOLF	31	2026-05-06 13:13:22.309442+05:30
18	3	Medical Retina	MEDI	7	2026-05-06 13:13:22.316396+05:30
19	3	Oculoplasty	OCUL	3	2026-05-06 13:13:22.322552+05:30
20	3	Pediatric Ophthalmology	PEDI	4	2026-05-06 13:13:22.328001+05:30
21	3	Phaco Refractive	PHAC	1	2026-05-06 13:13:22.335524+05:30
22	3	Vitreo Retina	VITR	8	2026-05-06 13:13:22.343077+05:30
\.


--
-- Data for Name: units; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.units (id, name, city, location, created_at) FROM stdin;
1	Sankara Eye Hospital - Bangalore	Bangalore	\N	2026-05-05 13:08:18.306693+05:30
2	Sankara Eye Hospital - Shimoga	Shimoga	\N	2026-05-05 13:08:18.306693+05:30
3	Sankara Eye Hospital - Coimbatore	Coimbatore	\N	2026-05-05 13:08:18.306693+05:30
4	Sankara Eye Hospital - Hyderabad	Hyderabad	\N	2026-05-05 13:08:18.306693+05:30
5	Sankara Eye Hospital - Anand	Anand	\N	2026-05-05 13:08:18.306693+05:30
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password_hash, salutation, full_name, employee_id, designation, gender, avatar_seed, role, unit_id, program_id, active, force_password_reset, created_at, updated_at) FROM stdin;
12	prabhanjan@sankaraeye.com	$2b$10$9zyPaIY1VdLyowiB3aFTaOZUQZIAs68Suij9ROz/NMJMZfKOdVQfu	\N	Prabhanjan	\N	\N	\N	\N	program_admin	\N	\N	t	f	2026-05-05 13:13:50.263666+05:30	2026-05-05 13:13:50.263666+05:30
11	saravanan@sankaraeye.com	$2b$10$tzKB/Dj.bn.MPCUj5GJQz.V6.ijFrypzqkwSjMW458ni7dCAx0MuS	\N	Saravanan	\N	\N	\N	\N	super_admin	\N	\N	t	f	2026-05-05 13:13:50.263666+05:30	2026-05-05 13:14:25.69+05:30
13	a@sankaraeye.com	$2b$10$alrS6DQ9H3IRREQWGVuaR.vPVK0aTVU9Px7G28ZN2XB9z9UAgqEqm	Dr.	a	212	SER	female	\N	doctor	2	\N	t	t	2026-05-06 13:10:29.288441+05:30	2026-05-06 13:10:29.288441+05:30
14	b@sankaraeye.com	$2b$10$zuMY.nwpJOcc8cZymjKVMeWK1whKtt.rvulM4MQZ5JcfYqZyN.0cm	Dr.	B	23	SGH	male	\N	doctor	1	\N	t	t	2026-05-06 13:10:50.085753+05:30	2026-05-06 13:10:50.085753+05:30
\.


--
-- Name: allocations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.allocations_id_seq', 1, false);


--
-- Name: application_forms_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.application_forms_id_seq', 6, true);


--
-- Name: application_submissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.application_submissions_id_seq', 7, true);


--
-- Name: candidate_exam_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.candidate_exam_assignments_id_seq', 1, false);


--
-- Name: candidate_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.candidate_preferences_id_seq', 1, false);


--
-- Name: candidates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.candidates_id_seq', 3, true);


--
-- Name: doctor_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.doctor_assignments_id_seq', 2, true);


--
-- Name: documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.documents_id_seq', 1, false);


--
-- Name: exam_answers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.exam_answers_id_seq', 1, false);


--
-- Name: exam_attempts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.exam_attempts_id_seq', 1, false);


--
-- Name: exams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.exams_id_seq', 1, false);


--
-- Name: interview_panel_members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.interview_panel_members_id_seq', 2, true);


--
-- Name: interview_panels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.interview_panels_id_seq', 1, true);


--
-- Name: interview_scores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.interview_scores_id_seq', 1, false);


--
-- Name: panel_queue_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.panel_queue_id_seq', 2, true);


--
-- Name: payment_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_settings_id_seq', 2, true);


--
-- Name: programs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.programs_id_seq', 4, true);


--
-- Name: questions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.questions_id_seq', 1, false);


--
-- Name: seat_matrix_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.seat_matrix_entries_id_seq', 208, true);


--
-- Name: specialities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.specialities_id_seq', 22, true);


--
-- Name: units_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.units_id_seq', 5, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 14, true);


--
-- Name: allocations allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_pkey PRIMARY KEY (id);


--
-- Name: application_forms application_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_forms
    ADD CONSTRAINT application_forms_pkey PRIMARY KEY (id);


--
-- Name: application_forms application_forms_token_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_forms
    ADD CONSTRAINT application_forms_token_unique UNIQUE (token);


--
-- Name: application_submissions application_submissions_application_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_submissions
    ADD CONSTRAINT application_submissions_application_id_unique UNIQUE (application_id);


--
-- Name: application_submissions application_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_submissions
    ADD CONSTRAINT application_submissions_pkey PRIMARY KEY (id);


--
-- Name: candidate_exam_assignments candidate_exam_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_exam_assignments
    ADD CONSTRAINT candidate_exam_assignments_pkey PRIMARY KEY (id);


--
-- Name: candidate_preferences candidate_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_preferences
    ADD CONSTRAINT candidate_preferences_pkey PRIMARY KEY (id);


--
-- Name: candidates candidates_candidate_code_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidates
    ADD CONSTRAINT candidates_candidate_code_unique UNIQUE (candidate_code);


--
-- Name: candidates candidates_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidates
    ADD CONSTRAINT candidates_email_unique UNIQUE (email);


--
-- Name: candidates candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidates
    ADD CONSTRAINT candidates_pkey PRIMARY KEY (id);


--
-- Name: doctor_assignments doctor_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_assignments
    ADD CONSTRAINT doctor_assignments_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: exam_answers exam_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_answers
    ADD CONSTRAINT exam_answers_pkey PRIMARY KEY (id);


--
-- Name: exam_attempts exam_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_attempts
    ADD CONSTRAINT exam_attempts_pkey PRIMARY KEY (id);


--
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (id);


--
-- Name: interview_panel_members interview_panel_members_panel_id_doctor_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_panel_members
    ADD CONSTRAINT interview_panel_members_panel_id_doctor_id_key UNIQUE (panel_id, doctor_id);


--
-- Name: interview_panel_members interview_panel_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_panel_members
    ADD CONSTRAINT interview_panel_members_pkey PRIMARY KEY (id);


--
-- Name: interview_panels interview_panels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_panels
    ADD CONSTRAINT interview_panels_pkey PRIMARY KEY (id);


--
-- Name: interview_scores interview_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_scores
    ADD CONSTRAINT interview_scores_pkey PRIMARY KEY (id);


--
-- Name: panel_queue panel_queue_panel_id_candidate_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.panel_queue
    ADD CONSTRAINT panel_queue_panel_id_candidate_id_key UNIQUE (panel_id, candidate_id);


--
-- Name: panel_queue panel_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.panel_queue
    ADD CONSTRAINT panel_queue_pkey PRIMARY KEY (id);


--
-- Name: payment_settings payment_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_settings
    ADD CONSTRAINT payment_settings_pkey PRIMARY KEY (id);


--
-- Name: programs programs_code_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_code_unique UNIQUE (code);


--
-- Name: programs programs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_pkey PRIMARY KEY (id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: seat_matrix_entries seat_matrix_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seat_matrix_entries
    ADD CONSTRAINT seat_matrix_entries_pkey PRIMARY KEY (id);


--
-- Name: seat_matrix_entries seat_matrix_entries_prog_spec_unit_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seat_matrix_entries
    ADD CONSTRAINT seat_matrix_entries_prog_spec_unit_key UNIQUE (program_id, speciality, unit_name);


--
-- Name: specialities specialities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.specialities
    ADD CONSTRAINT specialities_pkey PRIMARY KEY (id);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: interview_panel_members interview_panel_members_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_panel_members
    ADD CONSTRAINT interview_panel_members_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: interview_panel_members interview_panel_members_panel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_panel_members
    ADD CONSTRAINT interview_panel_members_panel_id_fkey FOREIGN KEY (panel_id) REFERENCES public.interview_panels(id) ON DELETE CASCADE;


--
-- Name: interview_panels interview_panels_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_panels
    ADD CONSTRAINT interview_panels_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id);


--
-- Name: panel_queue panel_queue_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.panel_queue
    ADD CONSTRAINT panel_queue_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;


--
-- Name: panel_queue panel_queue_panel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.panel_queue
    ADD CONSTRAINT panel_queue_panel_id_fkey FOREIGN KEY (panel_id) REFERENCES public.interview_panels(id) ON DELETE CASCADE;


--
-- Name: seat_matrix_entries seat_matrix_entries_program_id_programs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seat_matrix_entries
    ADD CONSTRAINT seat_matrix_entries_program_id_programs_id_fk FOREIGN KEY (program_id) REFERENCES public.programs(id);


--
-- PostgreSQL database dump complete
--

\unrestrict nlRsVSMwcMvnOJyZHy2MBg4Ywyl0HbcsRgR512bEFYB5wsNHjP1NNNo4AvXKTGK

