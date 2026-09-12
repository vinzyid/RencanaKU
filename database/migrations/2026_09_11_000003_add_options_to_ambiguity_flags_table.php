<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ambiguity_flags', function (Blueprint $table) {
            // Pilihan jawaban siap-klik (JSON array of string) untuk memudahkan
            // pengguna awam menjawab tanpa harus mengetik.
            $table->json('options')->nullable()->after('question');
        });
    }

    public function down(): void
    {
        Schema::table('ambiguity_flags', function (Blueprint $table) {
            $table->dropColumn('options');
        });
    }
};
