<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ambiguity_flags', function (Blueprint $table) {
            $table->string('code')->nullable()->after('prd_version_id');
        });
    }

    public function down(): void
    {
        Schema::table('ambiguity_flags', function (Blueprint $table) {
            $table->dropColumn('code');
        });
    }
};
